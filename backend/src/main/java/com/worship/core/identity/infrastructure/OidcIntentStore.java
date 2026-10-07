package com.worship.core.identity.infrastructure;
import java.time.*;
import java.sql.Timestamp;
import java.util.Map;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
@Repository
public class OidcIntentStore {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final Clock clock;
    public record Intent(String mode, Actor actor) {}
    public OidcIntentStore(JdbcTemplate jdbc, TransactionTemplate tx, Clock clock) { this.jdbc = jdbc; this.tx = tx; this.clock = clock; }
    public void create(String state, String mode, Actor actor) {
        tx.executeWithoutResult(status -> jdbc.update("INSERT INTO oidc_intent(state_hash,mode,user_id,session_version,reauthenticated_at,expires_at) VALUES(?,?,?,?,?,?)",
            IdentityService.hash(state), mode, actor == null ? null : actor.userId(), actor == null ? null : actor.sessionVersion(),
            actor == null ? null : LocalDateTime.ofInstant(actor.reauthenticatedAt(), ZoneOffset.UTC), LocalDateTime.ofInstant(clock.instant().plusSeconds(300), ZoneOffset.UTC)));
    }
    public Intent consume(String state) {
        return tx.execute(status -> {
            var rows = jdbc.queryForList("SELECT * FROM oidc_intent WHERE state_hash=? FOR UPDATE", IdentityService.hash(state));
            if (rows.size() != 1) throw Errors.invalid("Invalid OAuth intent");
            Map<String,Object> row = rows.getFirst();
            if (Boolean.TRUE.equals(row.get("consumed")) || !((LocalDateTime) row.get("expires_at")).toInstant(ZoneOffset.UTC).isAfter(clock.instant())) throw Errors.invalid("Expired or used OAuth intent");
            jdbc.update("UPDATE oidc_intent SET consumed=TRUE WHERE id=?", row.get("id"));
            Actor actor = row.get("user_id") == null ? null : new Actor(((Number) row.get("user_id")).longValue(), ((Number) row.get("session_version")).longValue(), ((LocalDateTime) row.get("reauthenticated_at")).toInstant(ZoneOffset.UTC));
            return new Intent((String) row.get("mode"), actor);
        });
    }
    public void discard(String state) {
        if (state != null) tx.executeWithoutResult(status -> jdbc.update("UPDATE oidc_intent SET consumed=TRUE WHERE state_hash=?", IdentityService.hash(state)));
    }
}
