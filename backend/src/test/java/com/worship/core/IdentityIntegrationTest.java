package com.worship.core;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import com.worship.core.identity.application.*;
import com.worship.core.identity.infrastructure.*;
import com.worship.core.shared.application.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Testcontainers
@Import(IdentityIntegrationTest.Fakes.class)
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class IdentityIntegrationTest {
    static final String PASSWORD = "a-test-password-123";
    static final String GOOGLE = "https://accounts.google.com";
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", MYSQL::getJdbcUrl); p.add("spring.datasource.username", MYSQL::getUsername); p.add("spring.datasource.password", MYSQL::getPassword);
    }
    @TestConfiguration static class Fakes {
        @Bean @Primary CapturingEmailSender emails() { return new CapturingEmailSender(); }
    }
    static class CapturingEmailSender implements EmailSender {
        record Message(String email, String token, boolean reset) {}
        final List<Message> messages = new CopyOnWriteArrayList<>();
        volatile boolean fail;
        public void sendVerification(String email, String token) { send(email, token, false); }
        public void sendPasswordReset(String email, String token) { send(email, token, true); }
        private void send(String email, String token, boolean reset) {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            if (fail) throw new IllegalStateException("simulated email outage");
            messages.add(new Message(email, token, reset));
        }
        String latest(String email, boolean reset) {
            return messages.stream().filter(m -> m.email().equals(email) && m.reset() == reset).reduce((a,b) -> b).orElseThrow().token();
        }
    }
    @Autowired IdentityService identity;
    @Autowired CapturingEmailSender email;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired OidcIntentStore intents;
    private String freshEmail() { return UUID.randomUUID() + "@example.org"; }
    private Actor account(String address) {
        identity.signup(address, PASSWORD); identity.verify(email.latest(address, false)); return identity.login(address, PASSWORD);
    }
    private void status(Throwable failure, int status) { assertThat(failure).isInstanceOf(CapabilityException.class); assertThat(((CapabilityException) failure).status()).isEqualTo(status); }
    private org.springframework.test.web.servlet.result.StatusResultMatchers status() {
        return org.springframework.test.web.servlet.result.MockMvcResultMatchers.status();
    }

    @Test void canonicalEmailRequiresVerificationAndTokenIsHashedSingleUse() {
        String address = freshEmail(); identity.signup("  " + address.toUpperCase(Locale.ROOT) + "  ", PASSWORD);
        status(catchThrowable(() -> identity.login(address, PASSWORD)), 401);
        String token = email.latest(address, false);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account_token WHERE token_hash=?", Integer.class, token)).isZero();
        identity.verify(token); assertThat(identity.login(address, PASSWORD).userId()).isPositive();
        status(catchThrowable(() -> identity.verify(token)), 400);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM password_credential WHERE user_id=?", String.class, identity.login(address,PASSWORD).userId())).startsWith("$argon2id$");
    }

    @Test void expiredVerificationAndResetAreRejected() {
        String address = freshEmail(); identity.signup(address, PASSWORD);
        String token = email.latest(address, false);
        jdbc.update("UPDATE account_token SET expires_at='2000-01-01' WHERE token_hash=?", IdentityService.hash(token));
        status(catchThrowable(() -> identity.verify(token)), 400);
        identity.resendVerification(jdbc.queryForObject("SELECT user_id FROM account_token WHERE token_hash=?",Long.class,IdentityService.hash(token)),address);
        identity.verify(email.latest(address,false)); identity.requestReset(address);
        String reset = email.latest(address,true);
        jdbc.update("UPDATE account_token SET expires_at='2000-01-01' WHERE token_hash=?", IdentityService.hash(reset));
        status(catchThrowable(() -> identity.reset(reset,"new-test-password-123")),400);
    }

    @Test void verificationRaceAllowsExactlyOneOwner() throws Exception {
        String address = freshEmail(); identity.signup(address,PASSWORD); String first = email.latest(address,false);
        identity.signup(address,PASSWORD); String second = email.latest(address,false);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            Callable<Boolean> a = () -> { barrier.await(); return verifyRace(first); };
            Callable<Boolean> b = () -> { barrier.await(); return verifyRace(second); };
            var futures = List.of(executor.submit(a),executor.submit(b));
            int successes = 0; for (var future : futures) if (future.get(20,TimeUnit.SECONDS)) successes++;
            assertThat(successes).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_email WHERE verified_email=?",Integer.class,address)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account_token WHERE token_hash IN (?,?) AND consumed=TRUE",Integer.class,IdentityService.hash(first),IdentityService.hash(second))).isEqualTo(1);
    }
    boolean verifyRace(String token){
        try{identity.verify(token);return true;}catch(org.springframework.dao.DataIntegrityViolationException expected){
            Throwable root=expected;while(root.getCause()!=null)root=root.getCause();
            assertThat(root).isInstanceOf(java.sql.SQLException.class).hasMessageContaining("verified_email_owner");
            assertThat(((java.sql.SQLException)root).getErrorCode()).isEqualTo(1062);return false;
        }
    }

    @Test void concurrentSameTokenIsConsumedOnlyOnce() throws Exception {
        String address = freshEmail(); identity.signup(address,PASSWORD); String token = email.latest(address,false);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            Callable<Boolean> work = () -> { barrier.await(); try { identity.verify(token); return true; } catch (CapabilityException expected) {
                assertThat(expected.status()).isEqualTo(400);assertThat(expected.code()).isEqualTo("VALIDATION_FAILED");assertThat(expected.getMessage()).isEqualTo("Invalid or expired token");return false;
            } };
            var first=executor.submit(work); var second=executor.submit(work);
            assertThat((first.get(20,TimeUnit.SECONDS)?1:0)+(second.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account_token WHERE token_hash=? AND consumed=TRUE",Integer.class,IdentityService.hash(token))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log a JOIN user_email e ON e.user_id=a.actor_id WHERE e.email=? AND a.event='EMAIL_VERIFIED'",Integer.class,address)).isEqualTo(1);
    }

    @Test void emailsSupportVerifyPrimaryRemovalAndRequireRecentAuthentication() {
        String address = freshEmail(), alternate=freshEmail(); Actor actor=account(address);
        identity.addEmail(actor,alternate); identity.verify(email.latest(alternate,false));
        var view=identity.get(actor); long first=view.emails().stream().filter(e->e.email().equals(address)).findFirst().orElseThrow().id();
        long second=view.emails().stream().filter(e->e.email().equals(alternate)).findFirst().orElseThrow().id();
        status(catchThrowable(() -> identity.setPrimary(new Actor(actor.userId(),actor.sessionVersion(),Instant.EPOCH),second)),403);
        status(catchThrowable(() -> identity.removeEmail(actor,first)),409);
        identity.setPrimary(actor,second); identity.removeEmail(actor,first);
        status(catchThrowable(() -> identity.login(address,PASSWORD)),401);
        assertThat(identity.login(alternate,PASSWORD).userId()).isEqualTo(actor.userId());
    }

    @Test void googleUsesIssuerSubjectAndNeverMergesByEmail() {
        String address=freshEmail(); Actor actor=account(address); String subject=UUID.randomUUID().toString();
        status(catchThrowable(() -> identity.googleLogin(GOOGLE,subject,address,true)),409);
        status(catchThrowable(() -> identity.googleLink(new Actor(actor.userId(),actor.sessionVersion(),Instant.EPOCH),GOOGLE,subject)),403);
        identity.googleLink(actor,GOOGLE,subject);
        assertThat(identity.googleLogin(GOOGLE,subject,"different@example.org",false).userId()).isEqualTo(actor.userId());
        status(catchThrowable(() -> identity.googleLogin("https://untrusted.example",subject,address,true)),400);
        status(catchThrowable(() -> identity.googleLink(actor,GOOGLE,subject)),409);
    }

    @Test void googleOnlyCanAddPasswordButCannotRemoveItsLastMethod() {
        Actor actor=identity.googleLogin(GOOGLE,UUID.randomUUID().toString(),freshEmail(),true);
        long googleId=identity.get(actor).googleIdentityIds().getFirst();
        status(catchThrowable(() -> identity.unlinkGoogle(actor,googleId)),409);
        identity.setPassword(actor,PASSWORD); identity.unlinkGoogle(actor,googleId);
        status(catchThrowable(() -> identity.removePassword(actor)),409);
    }

    @Test void resetInvalidatesAllSessionsAndRejectsReplay() {
        String address=freshEmail(); Actor actor=account(address); identity.requestReset(address); String raw=email.latest(address,true);
        identity.reset(raw,"new-test-password-123"); assertThat(identity.valid(actor)).isFalse();
        status(catchThrowable(() -> identity.reset(raw,"another-test-password-123")),400);
        status(catchThrowable(() -> identity.login(address,PASSWORD)),401);
        assertThat(identity.login(address,"new-test-password-123").userId()).isEqualTo(actor.userId());
    }

    @Test void deliveryFailurePreservesAccountAndSupportsResend() {
        String address=freshEmail(); IdentityService.DeliveryResult result;
        email.fail=true; try { result=identity.signup(address,PASSWORD); } finally { email.fail=false; }
        assertThat(result.deliveryStatus()).isEqualTo("FAILED_RETRYABLE");
        identity.resendVerification(result.userId(),address); identity.verify(email.latest(address,false));
        assertThat(identity.login(address,PASSWORD).userId()).isEqualTo(result.userId());
    }

    @Test void oidcIntentIsBoundToActorAndSingleUseAndExpires() {
        Actor actor=account(freshEmail()); String state=UUID.randomUUID().toString(); intents.create(state,"LINK",actor);
        assertThat(intents.consume(state).actor()).isEqualTo(actor);
        status(catchThrowable(() -> intents.consume(state)),400);
        String expired=UUID.randomUUID().toString(); intents.create(expired,"LOGIN",null);
        jdbc.update("UPDATE oidc_intent SET expires_at='2000-01-01' WHERE state_hash=?",IdentityService.hash(expired));
        status(catchThrowable(() -> intents.consume(expired)),400);
    }

    private Cookie loginCookie(String address) throws Exception {
        var response=mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
            .content("{\"email\":\""+address+"\",\"password\":\""+PASSWORD+"\"}")).andExpect(status().isNoContent()).andReturn().getResponse();
        Cookie cookie=response.getCookie("SESSION"); assertThat(cookie).isNotNull();
        assertThat(cookie.getSecure()).isTrue(); assertThat(cookie.isHttpOnly()).isTrue(); return cookie;
    }

    @Test void passwordChangeKeepsCurrentBrowserFlowAndRevokesOtherJdbcSession() throws Exception {
        String address=freshEmail(); Actor actor=account(address); Cookie first=loginCookie(address), second=loginCookie(address);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME=?",Integer.class,Long.toString(actor.userId()))).isEqualTo(2);
        var changed=mvc.perform(post("/api/account/password/change").cookie(first).with(csrf()).contentType("application/json")
            .content("{\"oldPassword\":\""+PASSWORD+"\",\"newPassword\":\"new-test-password-123\"}")).andExpect(status().isNoContent()).andReturn().getResponse().getCookie("SESSION");
        assertThat(changed).isNotNull();
        mvc.perform(get("/api/account").cookie(changed)).andExpect(status().isOk());
        mvc.perform(get("/api/account").cookie(second)).andExpect(status().isUnauthorized());
        assertThat(identity.valid(actor)).isFalse();
    }

    @Test void withdrawErasesIdentityButPreservesAuditAndRequiresNewUser() throws Exception {
        String address=freshEmail(); Actor actor=account(address); Cookie cookie=loginCookie(address);
        identity.withdraw(actor); mvc.perform(get("/api/account").cookie(cookie)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_email WHERE user_id=?",Integer.class,actor.userId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE actor_id=?",Integer.class,actor.userId())).isPositive();
        assertThat(account(address).userId()).isNotEqualTo(actor.userId());
    }

    @Test void resetRevokesEveryPersistedBrowserSessionAndLogoutRequiresCsrf() throws Exception {
        String address=freshEmail();Actor actor=account(address);Cookie first=loginCookie(address),second=loginCookie(address);
        mvc.perform(post("/api/auth/logout").cookie(first)).andExpect(status().isForbidden());
        identity.requestReset(address);identity.reset(email.latest(address,true),"new-test-password-123");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME=?",Integer.class,Long.toString(actor.userId()))).isZero();
        mvc.perform(get("/api/account").cookie(first)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account").cookie(second)).andExpect(status().isUnauthorized());
    }
}
