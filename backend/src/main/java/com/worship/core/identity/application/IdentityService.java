package com.worship.core.identity.application;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import com.worship.core.identity.domain.*;
import com.worship.core.identity.infrastructure.IdentityStore;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.audit.application.AuditRecorder.*;
import com.worship.core.shared.application.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final IdentityStore store;
    private final AuditRecorder audit;
    private final PasswordEncoder passwords;
    private final EmailSender emailSender;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final List<AccountLifecycle> lifecycles;
    private final SecureRandom random = new SecureRandom();

    public IdentityService(IdentityStore store, PasswordEncoder passwords, EmailSender emailSender,
                           TransactionTemplate tx, Clock clock, List<AccountLifecycle> lifecycles, AuditRecorder audit) {
        this.store = store;
        this.passwords = passwords;
        this.emailSender = emailSender;
        this.tx = tx;
        this.clock = clock;
        this.lifecycles = lifecycles;
        this.audit = audit;
    }

    private void audit(long user, String event) {
        audit.record(user, event, clock.instant(), Target.account(TargetType.USER, user), null);
    }

    private void audit(long user, String event, Target target, Change change) {
        audit.record(user, event, clock.instant(), target, change);
    }

    public record EmailView(long id, String email, boolean verified, boolean primary) {
    }

    public record AccountView(long id, List<EmailView> emails, boolean passwordEnabled, List<Long> googleIdentityIds) {
    }

    public record DeliveryResult(long userId, String deliveryStatus) {
    }

    private record Delivery(long userId, String email, String token, boolean reset) {
    }

    public static String canonical(String email) {
        if (email == null) throw Errors.invalid("Email required");
        String value = email.trim().toLowerCase(Locale.ROOT);
        if (value.length() > 254 || !EMAIL.matcher(value).matches()) throw Errors.invalid("Invalid email");
        return value;
    }

    private String encode(String password) {
        if (password == null || password.length() < 12 || password.length() > 128)
            throw Errors.invalid("Password length must be 12–128 characters");
        return passwords.encode(password);
    }

    private UserAccount active(long id, boolean lock) {
        var user = store.account(id, lock);
        if (user == null || !user.active()) throw Errors.unauthenticated();
        return user;
    }

    private UserAccount authenticated(Actor actor, boolean recent) {
        return authenticated(actor, recent, false);
    }

    private UserAccount authenticated(Actor actor, boolean recent, boolean sharedRead) {
        if (actor == null) throw Errors.unauthenticated();
        var user = sharedRead ? store.accountForRead(actor.userId()) : active(actor.userId(), true);
        if (user == null || !user.active()) throw Errors.unauthenticated();
        if (actor.sessionVersion() != user.sessionVersion()) throw Errors.unauthenticated();
        if (recent && (actor.reauthenticatedAt() == null || actor.reauthenticatedAt().isBefore(clock.instant().minus(Duration.ofMinutes(5)))))
            throw new CapabilityException(403, "REAUTHENTICATION_REQUIRED", "Recent reauthentication required");
        return user;
    }

    public boolean valid(Actor actor) {
        return Boolean.TRUE.equals(tx.execute(status -> {
            var user = store.account(actor.userId(), false);
            return user != null && user.active() && user.sessionVersion() == actor.sessionVersion();
        }));
    }

    public AccountView get(Actor actor) {
        return tx.execute(status -> accountView(authenticated(actor, false, true)));
    }

    private AccountView accountView(UserAccount user) {
        return new AccountView(user.id(), store.emails(user.id()).stream().map(e -> new EmailView(e.id(), e.email(), e.verified(), e.primary())).toList(),
                store.password(user.id()) != null, store.identities(user.id()).stream().map(ExternalIdentity::id).toList());
    }

    /**
     * Details needed by a mutation (e.g. verified invitation email); never start with a shared lock.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AccountView getForChange(Actor actor) {
        return accountView(authenticated(actor, false));
    }

    /**
     * Authentication guard only; joins the caller's transaction and keeps its account lock.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAuthenticated(Actor actor) {
        authenticated(actor, false);
    }

    /**
     * Pure-read guard; locks remain held until the caller has materialized its response.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAuthenticatedForRead(Actor actor) {
        authenticated(actor, false, true);
    }

    public DeliveryResult signup(String email, String password) {
        String normalized = canonical(email), hash = encode(password);
        Delivery delivery = tx.execute(status -> {
            if (store.verifiedEmail(normalized).isPresent()) throw Errors.conflict("Email already owned");
            var user = store.create(clock.instant());
            var address = new UserEmail(user.id(), normalized, true, false);
            store.save(address);
            store.save(new PasswordCredential(user.id(), hash));
            audit(user.id(), "ACCOUNT_CREATED", Target.account(TargetType.USER, user.id()), new Change(Field.STATE, null, "ACTIVE"));
            return issue(user.id(), address, false);
        });
        return deliver(delivery);
    }

    private Delivery issue(long userId, UserEmail email, boolean reset) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.save(new AccountToken(userId, email.id(), reset ? "RESET" : "VERIFY", hash(raw), clock.instant().plus(reset ? Duration.ofMinutes(30) : Duration.ofHours(24))));
        return new Delivery(userId, email.email(), raw, reset);
    }

    private DeliveryResult deliver(Delivery delivery) {
        try {
            if (delivery.reset()) emailSender.sendPasswordReset(delivery.email(), delivery.token());
            else emailSender.sendVerification(delivery.email(), delivery.token());
            return new DeliveryResult(delivery.userId(), "SENT");
        } catch (RuntimeException failure) {
            tx.executeWithoutResult(status -> audit(delivery.userId(), "EMAIL_DELIVERY_FAILED"));
            return new DeliveryResult(delivery.userId(), "FAILED_RETRYABLE");
        }
    }

    public void resendVerification(long userId, String email) {
        String normalized = canonical(email);
        Delivery delivery = tx.execute(status -> {
            var user = store.account(userId, true);
            if (user == null || !user.active()) return null;
            return store.emails(userId).stream().filter(e -> e.primary() && !e.verified() && e.email().equals(normalized))
                    .findFirst().map(e -> issue(userId, e, false)).orElse(null);
        });
        if (delivery != null) deliver(delivery);
    }

    public DeliveryResult addEmail(Actor actor, String email) {
        String normalized = canonical(email);
        Delivery delivery = tx.execute(status -> {
            var user = authenticated(actor, false);
            if (store.emails(user.id()).stream().anyMatch(e -> e.email().equals(normalized)))
                throw Errors.conflict("Email already added");
            var address = new UserEmail(user.id(), normalized, false, false);
            store.save(address);
            audit(user.id(), "EMAIL_ADDED", Target.account(TargetType.EMAIL, address.id()), new Change(Field.VERIFICATION, null, "FALSE"));
            return issue(user.id(), address, false);
        });
        return deliver(delivery);
    }

    public DeliveryResult resendEmail(Actor actor, long emailId) {
        Delivery delivery = tx.execute(status -> {
            var user = authenticated(actor, false);
            var email = ownedEmail(user.id(), emailId);
            if (email.verified()) throw Errors.conflict("Email already verified");
            return issue(user.id(), email, false);
        });
        return deliver(delivery);
    }

    public void verify(String raw) {
        tx.executeWithoutResult(status -> {
            var token = checkedToken(raw, "VERIFY");
            var email = ownedEmail(token.userId(), token.emailId());
            boolean before = email.verified();
            email.verify();
            token.consume();
            store.flush();
            audit(token.userId(), "EMAIL_VERIFIED", Target.account(TargetType.EMAIL, email.id()), new Change(Field.VERIFICATION, before ? "TRUE" : "FALSE", "TRUE"));
        });
    }

    private AccountToken checkedToken(String raw, String kind) {
        var token = store.token(hash(raw));
        if (token == null) throw Errors.invalid("Invalid or expired token");
        active(token.userId(), true);
        token = store.refreshToken(token);
        if (!token.usable(kind, clock.instant())) throw Errors.invalid("Invalid or expired token");
        return token;
    }

    private UserEmail ownedEmail(long userId, long emailId) {
        var email = store.email(emailId);
        if (email == null || email.userId() != userId) throw Errors.missing();
        return email;
    }

    public Actor login(String email, String password) {
        String normalized = canonical(email);
        return tx.execute(status -> {
            var address = store.verifiedEmail(normalized).filter(UserEmail::primary).orElseThrow(Errors::unauthenticated);
            var user = active(address.userId(), true);
            store.refreshEmail(address);
            if (!address.primary() || !address.verified()) throw Errors.unauthenticated();
            var credential = store.password(user.id());
            if (credential == null || password == null || !passwords.matches(password, credential.hash()))
                throw Errors.unauthenticated();
            audit(user.id(), "PASSWORD_LOGIN");
            return new Actor(user.id(), user.sessionVersion(), clock.instant());
        });
    }

    public Actor reauthenticate(Actor actor, String password) {
        return tx.execute(status -> {
            var user = authenticated(actor, false);
            var credential = store.password(user.id());
            if (credential == null || password == null || !passwords.matches(password, credential.hash()))
                throw Errors.unauthenticated();
            audit(user.id(), "PASSWORD_REAUTHENTICATED");
            return new Actor(user.id(), user.sessionVersion(), clock.instant());
        });
    }

    public void setPrimary(Actor actor, long emailId) {
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            var email = ownedEmail(user.id(), emailId);
            if (!email.verified()) throw Errors.invalid("Primary email must be verified");
            boolean before = email.primary();
            for (var previous : store.emails(user.id())) {
                if (previous.primary() && previous.id() != emailId) {
                    previous.primary(false);
                    audit(user.id(), "PRIMARY_EMAIL_CLEARED", Target.account(TargetType.EMAIL, previous.id()), new Change(Field.PRIMARY, "TRUE", "FALSE"));
                } else previous.primary(false);
            }
            store.flush();
            email.primary(true);
            audit(user.id(), "PRIMARY_EMAIL_CHANGED", Target.account(TargetType.EMAIL, email.id()), new Change(Field.PRIMARY, before ? "TRUE" : "FALSE", "TRUE"));
        });
    }

    public void removeEmail(Actor actor, long emailId) {
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            var email = ownedEmail(user.id(), emailId);
            boolean passwordUsable = store.password(user.id()) != null && store.emails(user.id()).stream()
                    .anyMatch(e -> e.id() != emailId && e.primary() && e.verified());
            if (!passwordUsable && store.identities(user.id()).isEmpty())
                throw Errors.conflict("Last login method cannot be removed");
            store.deleteEmailTokens(emailId);
            store.delete(email);
            audit(user.id(), "EMAIL_REMOVED", Target.account(TargetType.EMAIL, emailId), null);
        });
    }

    public Actor changePassword(Actor actor, String oldPassword, String newPassword, String currentSessionId) {
        String hash = encode(newPassword);
        return tx.execute(status -> {
            var user = authenticated(actor, false);
            var credential = store.password(user.id());
            if (credential == null || oldPassword == null || !passwords.matches(oldPassword, credential.hash()))
                throw Errors.unauthenticated();
            credential.replace(hash);
            store.consumeTokens(user.id(), "RESET");
            user.invalidateSessions();
            store.deleteOtherSessions(user.id(), currentSessionId);
            audit(user.id(), "PASSWORD_CHANGED");
            return new Actor(user.id(), user.sessionVersion(), clock.instant());
        });
    }

    public void setPassword(Actor actor, String password) {
        String hash = encode(password);
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            if (store.password(user.id()) != null) throw Errors.conflict("Password already enabled");
            if (store.emails(user.id()).stream().noneMatch(e -> e.primary() && e.verified()))
                throw Errors.invalid("Verified primary email required");
            store.save(new PasswordCredential(user.id(), hash));
            audit(user.id(), "PASSWORD_ENABLED", Target.account(TargetType.USER, user.id()), new Change(Field.PASSWORD_ENABLED, "FALSE", "TRUE"));
        });
    }

    public void removePassword(Actor actor) {
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            if (store.identities(user.id()).isEmpty()) throw Errors.conflict("Last login method cannot be removed");
            var credential = store.password(user.id());
            if (credential != null) store.delete(credential);
            audit(user.id(), "PASSWORD_REMOVED", Target.account(TargetType.USER, user.id()), new Change(Field.PASSWORD_ENABLED, credential == null ? "FALSE" : "TRUE", "FALSE"));
        });
    }

    public void requestReset(String email) {
        String normalized = canonical(email);
        Delivery delivery = tx.execute(status -> store.verifiedEmail(normalized).filter(UserEmail::primary).map(address -> {
            var user = active(address.userId(), true);
            if (store.password(user.id()) == null) return null;
            return issue(user.id(), address, true);
        }).orElse(null));
        if (delivery != null) deliver(delivery);
    }

    public void reset(String raw, String password) {
        String hash = encode(password);
        tx.executeWithoutResult(status -> {
            var token = checkedToken(raw, "RESET");
            var email = ownedEmail(token.userId(), token.emailId());
            if (!email.primary() || !email.verified()) throw Errors.invalid("Reset target is no longer primary");
            var credential = store.password(token.userId());
            if (credential == null) throw Errors.invalid("Password not enabled");
            credential.replace(hash);
            token.consume();
            store.consumeTokens(token.userId(), "RESET");
            active(token.userId(), true).invalidateSessions();
            store.deleteSessions(token.userId());
            audit(token.userId(), "PASSWORD_RESET");
        });
    }

    /**
     * Only invoked with issuer/subject from the adapter's Spring-validated OIDC response.
     */
    public Actor googleLogin(String issuer, String subject, String email, boolean verified) {
        requireGoogle(issuer, subject);
        return tx.execute(status -> {
            var identity = store.identity(issuer, subject);
            if (identity.isPresent()) {
                var user = active(identity.get().userId(), true);
                audit(user.id(), "GOOGLE_LOGIN", Target.account(TargetType.GOOGLE_IDENTITY, identity.get().id()), null);
                return new Actor(user.id(), user.sessionVersion(), clock.instant());
            }
            if (!verified) throw Errors.invalid("Verified Google email required");
            String normalized = canonical(email);
            if (store.verifiedEmail(normalized).isPresent())
                throw Errors.conflict("Sign in to the existing account and explicitly link Google");
            var user = store.create(clock.instant());
            store.save(new UserEmail(user.id(), normalized, true, true));
            store.save(new ExternalIdentity(user.id(), issuer, subject));
            store.flush();
            audit(user.id(), "GOOGLE_ACCOUNT_CREATED", Target.account(TargetType.USER, user.id()), new Change(Field.STATE, null, "ACTIVE"));
            return new Actor(user.id(), user.sessionVersion(), clock.instant());
        });
    }

    public Actor googleLink(Actor actor, String issuer, String subject) {
        requireGoogle(issuer, subject);
        return tx.execute(status -> {
            var user = authenticated(actor, true);
            if (store.identity(issuer, subject).isPresent()) throw Errors.conflict("Identity already linked");
            var linked = new ExternalIdentity(user.id(), issuer, subject);
            store.save(linked);
            store.flush();
            audit(user.id(), "GOOGLE_LINKED", Target.account(TargetType.GOOGLE_IDENTITY, linked.id()), new Change(Field.CONNECTION, "FALSE", "TRUE"));
            return new Actor(user.id(), user.sessionVersion(), actor.reauthenticatedAt());
        });
    }

    public Actor googleReauthenticate(Actor actor, String issuer, String subject) {
        requireGoogle(issuer, subject);
        return tx.execute(status -> {
            var user = authenticated(actor, false);
            var identity = store.identity(issuer, subject).orElseThrow(Errors::unauthenticated);
            if (identity.userId() != user.id()) throw Errors.unauthenticated();
            audit(user.id(), "GOOGLE_REAUTHENTICATED", Target.account(TargetType.GOOGLE_IDENTITY, identity.id()), null);
            return new Actor(user.id(), user.sessionVersion(), clock.instant());
        });
    }

    public void unlinkGoogle(Actor actor, long identityId) {
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            var identities = store.identities(user.id());
            var identity = identities.stream().filter(i -> i.id() == identityId).findFirst().orElseThrow(Errors::missing);
            boolean passwordUsable = store.password(user.id()) != null && store.emails(user.id()).stream().anyMatch(e -> e.primary() && e.verified());
            if (!passwordUsable && identities.size() == 1) throw Errors.conflict("Last login method cannot be removed");
            store.delete(identity);
            audit(user.id(), "GOOGLE_UNLINKED", Target.account(TargetType.GOOGLE_IDENTITY, identityId), new Change(Field.CONNECTION, "TRUE", "FALSE"));
        });
    }

    public void withdraw(Actor actor) {
        tx.executeWithoutResult(status -> {
            var user = authenticated(actor, true);
            lifecycles.forEach(l -> l.beforeWithdraw(user.id()));
            store.deleteTokens(user.id());
            var credential = store.password(user.id());
            if (credential != null) store.delete(credential);
            store.identities(user.id()).forEach(store::delete);
            store.emails(user.id()).forEach(store::delete);
            user.withdraw();
            store.deleteSessions(user.id());
            audit(user.id(), "ACCOUNT_WITHDRAWN", Target.account(TargetType.USER, user.id()), new Change(Field.STATE, "ACTIVE", "WITHDRAWN"));
        });
    }

    private static void requireGoogle(String issuer, String subject) {
        if (!"https://accounts.google.com".equals(issuer) || subject == null || subject.isBlank() || subject.length() > 255)
            throw Errors.invalid("Invalid Google identity");
    }

    public static String hash(String raw) {
        if (raw == null || raw.length() > 512) throw Errors.invalid("Invalid token");
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
