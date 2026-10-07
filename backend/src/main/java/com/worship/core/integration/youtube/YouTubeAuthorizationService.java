package com.worship.core.integration.youtube;

import java.security.*;
import java.time.Clock;
import java.util.*;

import com.worship.core.identity.application.*;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.audit.application.AuditRecorder.*;
import com.worship.core.shared.application.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class YouTubeAuthorizationService implements AccountLifecycle {
    private final ObjectProvider<IdentityService> identity;
    private final AuditRecorder audit;
    private final YouTubeStore store;
    private final YouTubeProvider provider;
    private final CredentialCipher cipher;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public YouTubeAuthorizationService(ObjectProvider<IdentityService> identity, AuditRecorder audit, YouTubeStore store, YouTubeProvider provider, CredentialCipher cipher, TransactionTemplate tx, Clock clock) {
        this.identity = identity;
        this.audit = audit;
        this.store = store;
        this.provider = provider;
        this.cipher = cipher;
        this.tx = tx;
        this.clock = clock;
    }

    private String random() {
        byte[] b = new byte[32];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public String start(Actor actor) {
        cipher.requireConfigured();
        String state = random(), verifier = random();
        tx.executeWithoutResult(status -> {
            identity.getObject().requireAuthenticated(actor);
            store.intent(actor.userId(), actor.sessionVersion(), IdentityService.hash(state), cipher.encrypt(verifier, "youtube-verifier:" + actor.userId()), clock.instant().plusSeconds(300));
        });
        try {
            return provider.authorizationUrl(state, Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII))));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    public void complete(Actor actor, String state, String code) {
        if (code == null || code.isBlank() || code.length() > 2048) throw Errors.invalid("OAuth code required");
        String hash = IdentityService.hash(state);
        String verifier = tx.execute(status -> {
            identity.getObject().requireAuthenticated(actor);
            var intent = store.intent(hash);
            if (intent == null || intent.consumed() || intent.cancelled() || !intent.expires().isAfter(clock.instant()) || intent.userId() != actor.userId() || intent.version() != actor.sessionVersion())
                throw Errors.invalid("Invalid OAuth intent");
            store.consume(hash);
            return cipher.decrypt(intent.verifier(), "youtube-verifier:" + actor.userId());
        });
        String refresh = provider.exchange(code, verifier);
        if (refresh == null || refresh.isBlank()) throw new ProviderFailure(false);
        try {
            tx.executeWithoutResult(status -> {
                identity.getObject().requireAuthenticated(actor);
                var intent = store.intent(hash);
                if (intent == null || intent.cancelled()) throw Errors.conflict("OAuth intent was cancelled");
                store.connect(actor.userId(), cipher.encrypt(refresh, "youtube-refresh:" + actor.userId()));
                var auth = store.authorization(actor.userId());
                audit.record(actor.userId(), "YOUTUBE_CONNECTED", clock.instant(), Target.account(TargetType.YOUTUBE_AUTHORIZATION, auth.id()), new Change(Field.CONNECTION, "FALSE", "TRUE"));
            });
        } catch (RuntimeException failure) {
            try {
                provider.revoke(refresh);
            } catch (RuntimeException cleanup) {
                org.slf4j.LoggerFactory.getLogger(YouTubeAuthorizationService.class).error("OAuth compensation revoke failed for user={}", actor.userId());
            }
            throw failure;
        }
    }

    public boolean connected(Actor actor) {
        return Boolean.TRUE.equals(tx.execute(status -> {
            identity.getObject().requireAuthenticatedForRead(actor);
            return store.authorization(actor.userId()) != null;
        }));
    }

    public record DisconnectResult(boolean connected, String revokeStatus) {
    }

    public DisconnectResult disconnect(Actor actor) {
        String encrypted = tx.execute(status -> {
            identity.getObject().requireAuthenticated(actor);
            var auth = store.authorization(actor.userId());
            store.disconnect(actor.userId());
            audit.record(actor.userId(), "YOUTUBE_DISCONNECTED", clock.instant(), Target.account(auth == null ? TargetType.USER : TargetType.YOUTUBE_AUTHORIZATION, auth == null ? actor.userId() : auth.id()), new Change(Field.CONNECTION, auth == null ? "FALSE" : "TRUE", "FALSE"));
            return auth == null ? null : auth.encryptedRefresh();
        });
        if (encrypted == null) return new DisconnectResult(false, "NOT_NEEDED");
        try {
            provider.revoke(cipher.decrypt(encrypted, "youtube-refresh:" + actor.userId()));
            return new DisconnectResult(false, "REVOKED");
        } catch (RuntimeException failure) {
            return new DisconnectResult(false, "PROVIDER_REVOKE_FAILED");
        }
    }

    public YouTubeStore.Authorization require(Actor actor) {
        identity.getObject().requireAuthenticated(actor);
        var auth = store.authorization(actor.userId());
        if (auth == null)
            throw new CapabilityException(403, "YOUTUBE_AUTHORIZATION_REQUIRED", "Connect YouTube authorization first");
        return auth;
    }

    public String refresh(Actor actor, YouTubeStore.Authorization auth) {
        return cipher.decrypt(auth.encryptedRefresh(), "youtube-refresh:" + actor.userId());
    }

    @Override
    public void beforeWithdraw(long userId) {
        var auth = store.authorization(userId);
        store.disconnect(userId);
        audit.record(userId, "YOUTUBE_AUTHORIZATION_DISCARDED", clock.instant(), Target.account(auth == null ? TargetType.USER : TargetType.YOUTUBE_AUTHORIZATION, auth == null ? userId : auth.id()), new Change(Field.CONNECTION, auth == null ? "FALSE" : "TRUE", "FALSE"));
    }
}
