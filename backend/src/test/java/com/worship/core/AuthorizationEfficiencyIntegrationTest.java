package com.worship.core;

import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import com.worship.core.document.application.DocumentService;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.song.application.SongService;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.Actor;
import com.worship.core.shared.application.CapabilityException;
import com.worship.core.workspace.application.WorkspaceService;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @Testcontainers
@Import({WorkspaceIntegrationTest.Fakes.class, IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class AuthorizationEfficiencyIntegrationTest {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", MYSQL::getJdbcUrl);
        properties.add("spring.datasource.username", MYSQL::getUsername);
        properties.add("spring.datasource.password", MYSQL::getPassword);
        properties.add("spring.jpa.properties.hibernate.session_factory.statement_inspector", () -> SqlTrace.class.getName());
    }
    public static class SqlTrace implements StatementInspector {
        private static final ThreadLocal<List<String>> statements = new ThreadLocal<>();
        @Override public String inspect(String sql) {
            var current = statements.get();
            if (current != null) current.add(sql.toLowerCase(Locale.ROOT));
            return sql;
        }
        static List<String> capture(Runnable work) {
            var current = new ArrayList<String>();
            statements.set(current);
            try { work.run(); return List.copyOf(current); }
            finally { statements.remove(); }
        }
    }
    @Autowired IdentityService identity;
    @Autowired WorkspaceService workspace;
    @Autowired DocumentService documents;
    @Autowired SetlistService setlists;
    @Autowired SongService songs;
    @Autowired TransactionTemplate tx;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;
    @Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    @Autowired JdbcTemplate jdbc;

    Actor account() {
        String address = UUID.randomUUID() + "@example.org";
        identity.signup(address, IdentityIntegrationTest.PASSWORD);
        identity.verify(email.latest(address, false));
        return identity.login(address, IdentityIntegrationTest.PASSWORD);
    }
    long join(Actor admin, long workspaceId, Actor member) {
        String address = identity.get(member).emails().getFirst().email();
        workspace.invite(admin, workspaceId, address, UUID.randomUUID().toString());
        return workspace.accept(member, invitations.tokens.get(address)).id();
    }
    String phase() { return Objects.requireNonNullElse(System.getenv("AUTHORIZATION_MEASUREMENT_PHASE"), "shared"); }
    void evidence(String name, String contents) throws Exception {
        Path directory = Path.of("build/reports/authorization");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve(phase() + "-" + name + ".txt"), contents);
        System.out.println("AUTHORIZATION " + phase() + " " + contents.replace('\n', ' '));
    }

    @Test void documentReadQueryCountAndLocalLatency() throws Exception {
        Actor owner = account(); long w = workspace.create(owner, "Query measurement").id();
        long d = documents.create(owner, w, "Sunday", "RESTRICTED").id();
        for (int i = 0; i < 5; i++) documents.get(owner, w, d);
        var durations = new ArrayList<Long>();
        var counts = new ArrayList<Integer>();
        List<String> sample = List.of();
        for (int i = 0; i < 40; i++) {
            long start = System.nanoTime();
            sample = SqlTrace.capture(() -> documents.get(owner, w, d));
            durations.add(System.nanoTime() - start); counts.add(sample.size());
        }
        durations.sort(Long::compareTo);
        evidence("query", "40 direct DocumentService.get calls; 5 warmups; statements=" + counts.stream().distinct().toList()
            + "; p50_ms=" + durations.get(19) / 1_000_000.0 + "; p95_ms=" + durations.get(37) / 1_000_000.0 + "\n" + String.join("\n", sample));
        assertThat(counts).allMatch(n -> n == (phase().equals("baseline") ? 8 : 5));
        if (!phase().equals("baseline")) {
            assertThat(sample).noneMatch(sql -> sql.contains("user_email") || sql.contains("password_credential") || sql.contains("external_identity"));
        }
        if (phase().equals("shared")) {
            assertThat(sample).filteredOn(sql -> sql.contains("for share")).hasSize(2);
            assertThat(sample).noneMatch(sql -> sql.contains("for update"));
        }
    }

    @Test void setlistReadCostsAreMeasuredWithoutLockingInTheCurrentQueryStrategy() throws Exception {
        Actor owner=account();
        long w=workspace.create(owner,"Setlist query measurement").id();
        long d=documents.create(owner,w,"Measured setlist","OPEN").id();
        long song=songs.register(owner,w,"Repeated song",null).id();
        long version=0;
        var report=new StringBuilder("Direct SetlistService.get; same Song reused; no Score/Reference; local evidence, not production load\n");
        for(int size:new int[]{1,10,30}){
            while(version<size)version=setlists.add(owner,w,d,song,version).version();
            var result=new java.util.concurrent.atomic.AtomicReference<SetlistService.SetlistView>();
            long start=System.nanoTime();
            var sql=SqlTrace.capture(()->result.set(setlists.get(owner,w,d)));
            double elapsed=(System.nanoTime()-start)/1_000_000.0;
            assertThat(result.get().items()).hasSize(size);
            assertThat(result.get().items()).allMatch(item->item.song().id()==song);
            assertThat(sql).noneMatch(statement->statement.contains("for update"));
            report.append("items=").append(size).append(" statements=").append(sql.size())
                .append(" song_queries=").append(sql.stream().filter(statement->statement.contains(" from song ")).count())
                .append(" elapsed_ms=").append(elapsed).append('\n');
        }
        evidence("setlist-query",report.toString());
    }

    @Test void heldReadContentionMeasurement() throws Exception {
        Actor first = account(), second = account(); long w = workspace.create(first, "Read contention").id();
        join(first, w, second); long d = documents.create(first, w, "Sunday", "OPEN").id();
        var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<?> holder = pool.submit(() -> tx.executeWithoutResult(status -> {
                documents.get(first, w, d); held.countDown(); await(release);
            }));
            try {
                assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                long start = System.nanoTime();
                var reader = pool.submit(() -> { entered.countDown(); return documents.get(second, w, d); });
                assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
                boolean blocked;
                try { reader.get(250, TimeUnit.MILLISECONDS); blocked = false; }
                catch (TimeoutException expected) { blocked = true; }
                evidence("contention", "another account, same workspace; read completed while first read transaction held=" + !blocked
                    + "; observation_ms=" + (System.nanoTime() - start) / 1_000_000.0 + "; 250ms observation window, not production benchmark");
                assertThat(blocked).isEqualTo(!phase().equals("shared"));
                release.countDown(); assertThat(reader.get(10, TimeUnit.SECONDS).id()).isEqualTo(d);
            } finally { release.countDown(); holder.get(10, TimeUnit.SECONDS); }
        }
    }
    @Test void leanAuthenticationStillRejectsInvalidatedSessionsAndRequiresCallerTransaction() {
        Actor owner = account(); long w = workspace.create(owner, "Session guard").id();
        long d = documents.create(owner, w, "Sunday", "OPEN").id();
        assertThatThrownBy(() -> identity.requireAuthenticated(owner)).isInstanceOf(IllegalTransactionStateException.class);
        tx.executeWithoutResult(status -> identity.requireAuthenticated(owner));
        jdbc.update("UPDATE user_account SET session_version=session_version+1 WHERE id=?", owner.userId());
        assertThatThrownBy(() -> documents.get(owner, w, d)).isInstanceOfSatisfying(CapabilityException.class, failure -> {
            assertThat(failure.status()).isEqualTo(401); assertThat(failure.code()).isEqualTo("AUTHENTICATION_REQUIRED");
        });
    }
    void denied(Throwable failure, int status, String code) {
        assertThat(failure).isInstanceOfSatisfying(CapabilityException.class, denied -> {
            assertThat(denied.status()).isEqualTo(status); assertThat(denied.code()).isEqualTo(code);
        });
    }
    void blocked(Future<?> work, CountDownLatch entered) throws Exception {
        assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> work.get(250, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
    }

    @Test void readFirstAllowsOtherReadsButAccessChangeWaitsAndSubsequentReadIsDenied() throws Exception {
        Actor owner = account(), member = account(); long w = workspace.create(owner, "Access race").id();
        join(owner, w, member); long d = documents.create(owner, w, "Sunday", "OPEN").id();
        var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(3)) {
            var reader = pool.submit(() -> tx.executeWithoutResult(status -> {
                assertThat(documents.get(member, w, d).accessPolicy()).isEqualTo("OPEN"); held.countDown(); await(release);
            }));
            try {
                assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                // Same account also shares its account lock, not just its workspace lock.
                assertThat(pool.submit(() -> documents.get(member, w, d)).get(10, TimeUnit.SECONDS).id()).isEqualTo(d);
                var writer = pool.submit(() -> { entered.countDown(); return documents.changeAccess(owner, w, d, "RESTRICTED", 0); });
                blocked(writer, entered); release.countDown();
                assertThat(writer.get(10, TimeUnit.SECONDS).accessPolicy()).isEqualTo("RESTRICTED");
                denied(catchThrowable(() -> documents.get(member, w, d)), 403, "ACCESS_DENIED");
                assertThat(documents.list(member, w)).isEmpty();
            } finally { release.countDown(); reader.get(10, TimeUnit.SECONDS); }
        }
    }

    @Test void grantRevocationFirstBlocksReadsUntilCommitThenDeniesThem() throws Exception {
        Actor owner = account(), viewer = account(); long w = workspace.create(owner, "Grant race").id();
        long member = join(owner, w, viewer); var original = documents.create(owner, w, "Sunday", "RESTRICTED");
        var granted = documents.grant(owner, w, original.id(), member, "VIEWER", original.version());
        long d = original.id(); var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var writer = pool.submit(() -> tx.executeWithoutResult(status -> {
                documents.revoke(owner, w, d, member, granted.version()); held.countDown(); await(release);
            }));
            try {
                assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                var reader = pool.submit(() -> { entered.countDown(); return catchThrowable(() -> documents.get(viewer, w, d)); });
                blocked(reader, entered); release.countDown(); writer.get(10, TimeUnit.SECONDS);
                denied(reader.get(10, TimeUnit.SECONDS), 403, "ACCESS_DENIED");
                assertThat(documents.list(viewer, w)).isEmpty();
            } finally { release.countDown(); writer.get(10, TimeUnit.SECONDS); }
        }
    }
    @Test void rolledBackRevocationPreservesGrantVersionAndAuditForWaitingReader() throws Exception {
        Actor owner = account(), viewer = account(); long w = workspace.create(owner, "Rollback race").id();
        long member = join(owner, w, viewer); var document = documents.create(owner, w, "Sunday", "RESTRICTED");
        var granted = documents.grant(owner, w, document.id(), member, "VIEWER", document.version());
        long d = document.id(); long auditBefore = jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE document_id=?", Long.class, d);
        var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var writer = pool.submit(() -> tx.executeWithoutResult(status -> {
                documents.revoke(owner, w, d, member, granted.version()); status.setRollbackOnly(); held.countDown(); await(release);
            }));
            try {
                assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                var reader = pool.submit(() -> { entered.countDown(); return documents.get(viewer, w, d); });
                blocked(reader, entered); release.countDown(); writer.get(10, TimeUnit.SECONDS);
                assertThat(reader.get(10, TimeUnit.SECONDS).version()).isEqualTo(granted.version());
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM document_grant WHERE document_id=? AND membership_id=?", Integer.class, d, member)).isEqualTo(1);
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE document_id=?", Long.class, d)).isEqualTo(auditBefore);
            } finally { release.countDown(); writer.get(10, TimeUnit.SECONDS); }
        }
    }

    @Test void openReadsSkipUnusedGrantLookupButNeverSkipEditAuthorization() {
        Actor owner = account(), member = account(); long w = workspace.create(owner, "Open query").id();
        join(owner, w, member); long d = documents.create(owner, w, "Sunday", "OPEN").id();
        var sql = SqlTrace.capture(() -> documents.get(member, w, d));
        assertThat(sql).hasSize(4).noneMatch(statement -> statement.contains("document_grant"));
        denied(catchThrowable(() -> setlists.update(member, w, d, "Not allowed", "", 0)), 403, "ACCESS_DENIED");
        assertThat(documents.get(owner, w, d).version()).isZero();
    }
    @Test void activeMembershipLookupUsesExistingUniqueIndexDespiteEndedHistory() throws Exception {
        Actor owner = account(); long w = workspace.create(owner, "Active index").id();
        long d = documents.create(owner, w, "Sunday", "OPEN").id();
        for (int i = 0; i < 50; i++) jdbc.update("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(?,?,'MEMBER','ENDED','LEFT')", w, owner.userId());
        var sql = SqlTrace.capture(() -> documents.get(owner, w, d));
        assertThat(sql).anyMatch(statement -> statement.contains("where m1_0.workspace_id=? and m1_0.active_user=?"));
        var plan = jdbc.queryForList("EXPLAIN SELECT id FROM workspace_membership WHERE workspace_id=? AND active_user=? AND state='ACTIVE'", w, owner.userId()).getFirst();
        assertThat(plan.get("key")).isEqualTo("active_membership");
        assertThat(((Number) plan.get("rows")).longValue()).isEqualTo(1);
        evidence("index", "50 ended + 1 active memberships for same user/workspace; existing index=" + plan.get("key") + "; estimated examined rows=" + plan.get("rows") + "; no DDL/index added");
    }

    @Test void membershipEndFirstBlocksReadsUntilCommitAndRejoinDoesNotRestoreGrant() throws Exception {
        Actor owner = account(), viewer = account(); long w = workspace.create(owner, "Membership race").id();
        long firstMembership = join(owner, w, viewer); var document = documents.create(owner, w, "Sunday", "RESTRICTED");
        documents.grant(owner, w, document.id(), firstMembership, "VIEWER", document.version());
        long d = document.id(); var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var writer = pool.submit(() -> tx.executeWithoutResult(status -> {
                workspace.remove(owner, w, firstMembership); held.countDown(); await(release);
            }));
            try {
                assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                var reader = pool.submit(() -> { entered.countDown(); return catchThrowable(() -> documents.get(viewer, w, d)); });
                blocked(reader, entered); release.countDown(); writer.get(10, TimeUnit.SECONDS);
                denied(reader.get(10, TimeUnit.SECONDS), 403, "ACCESS_DENIED");
            } finally { release.countDown(); writer.get(10, TimeUnit.SECONDS); }
        }
        assertThat(join(owner, w, viewer)).isNotEqualTo(firstMembership);
        denied(catchThrowable(() -> documents.get(viewer, w, d)), 403, "ACCESS_DENIED");
    }

    @Test void readsProtectAccountUntilSessionInvalidationOrWithdrawalCommits() throws Exception {
        for (boolean withdraw : List.of(false, true)) {
            Actor owner = account(), member = account(); long w = workspace.create(owner, "Account race").id();
            join(owner, w, member); long d = documents.create(owner, w, "Sunday", "OPEN").id();
            var held = new CountDownLatch(1); var release = new CountDownLatch(1); var entered = new CountDownLatch(1);
            try (var pool = Executors.newFixedThreadPool(2)) {
                var reader = pool.submit(() -> tx.executeWithoutResult(status -> {
                    documents.get(member, w, d); held.countDown(); await(release);
                }));
                try {
                    assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();
                    var writer = pool.submit(() -> {
                        entered.countDown();
                        if (withdraw) identity.withdraw(member);
                        else identity.changePassword(member, IdentityIntegrationTest.PASSWORD, IdentityIntegrationTest.PASSWORD + "!", "test-session");
                    });
                    blocked(writer, entered); release.countDown(); writer.get(10, TimeUnit.SECONDS);
                    denied(catchThrowable(() -> documents.get(member, w, d)), 401, "AUTHENTICATION_REQUIRED");
                } finally { release.countDown(); reader.get(10, TimeUnit.SECONDS); }
            }
        }
    }

    @Test void commandSnapshotsAndMutationsUseExclusiveGuardsFromEntry() {
        Actor owner = account(); long w = workspace.create(owner, "Command snapshot").id();
        long d = documents.create(owner, w, "Sunday", "RESTRICTED").id();
        assertThatThrownBy(() -> setlists.getForCommand(owner, w, d)).isInstanceOf(IllegalTransactionStateException.class);
        var snapshot = SqlTrace.capture(() -> tx.executeWithoutResult(status -> setlists.getForCommand(owner, w, d)));
        assertThat(snapshot).noneMatch(sql -> sql.contains("for share"));
        assertThat(snapshot).filteredOn(sql -> sql.contains("for update")).hasSize(2);
        var mutation = SqlTrace.capture(() -> documents.changeAccess(owner, w, d, "OPEN", 0));
        assertThat(mutation).noneMatch(sql -> sql.contains("for share"));
        assertThat(mutation).filteredOn(sql -> sql.contains("for update")).hasSize(2);
        assertThat(documents.get(owner, w, d).version()).isEqualTo(1);
    }

    @Test void mixedReadsAndChangesCompleteWithoutLockUpgradeOrLostVersions() throws Exception {
        Actor owner = account(), first = account(), second = account(); long w = workspace.create(owner, "Mixed traffic").id();
        join(owner, w, first); join(owner, w, second); long d = documents.create(owner, w, "Sunday", "OPEN").id();
        var start = new CountDownLatch(1); var timings = new ConcurrentLinkedQueue<Long>();
        long begin = System.nanoTime();
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = new ArrayList<Future<?>>();
            for (Actor reader : List.of(owner, first, second)) tasks.add(pool.submit(() -> {
                await(start);
                for (int i = 0; i < 100; i++) {
                    long at = System.nanoTime(); assertThat(documents.get(reader, w, d).id()).isEqualTo(d);
                    timings.add(System.nanoTime() - at);
                }
            }));
            tasks.add(pool.submit(() -> {
                await(start);
                for (int i = 0; i < 25; i++) assertThat(documents.changeAccess(owner, w, d, "OPEN", i).version()).isEqualTo(i + 1);
            }));
            start.countDown(); for (var task : tasks) task.get(30, TimeUnit.SECONDS);
        }
        double seconds = (System.nanoTime() - begin) / 1_000_000_000.0;
        var ordered = timings.stream().sorted().toList();
        evidence("mixed", "3 readers x100 + 1 writer x25; all completed; seconds=" + seconds + "; combined_ops_per_second=" + 325 / seconds
            + "; read_p50_ms=" + ordered.get(149) / 1_000_000.0 + "; read_p95_ms=" + ordered.get(284) / 1_000_000.0 + "; local synthetic workload only");
        assertThat(documents.get(owner, w, d).version()).isEqualTo(25);
    }
    static void await(CountDownLatch latch) {
        try { if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Latch deadline exceeded"); }
        catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new AssertionError(failure); }
    }
}
