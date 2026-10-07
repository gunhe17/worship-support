package com.worship.core.identity.infrastructure;
import java.io.Serializable;
import java.security.Principal;
import java.time.Instant;
import com.worship.core.shared.application.Actor;
public record AccountPrincipal(long userId, long sessionVersion, Instant reauthenticatedAt) implements Principal, Serializable {
    public AccountPrincipal(Actor actor) { this(actor.userId(), actor.sessionVersion(), actor.reauthenticatedAt()); }
    public String getName() { return Long.toString(userId); }
    public Actor actor() { return new Actor(userId, sessionVersion, reauthenticatedAt); }
}
