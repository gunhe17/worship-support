package com.worship.core.identity.domain;
import java.time.Instant;
import jakarta.persistence.*;
@Entity @Table(name = "user_account")
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String state;
    private long sessionVersion;
    private Instant createdAt;
    private String displayName;
    protected UserAccount() {}
    public UserAccount(Instant now) { state = "ACTIVE"; createdAt = now; }
    public long id() { return id; }
    public boolean active() { return "ACTIVE".equals(state); }
    public long sessionVersion() { return sessionVersion; }
    public long invalidateSessions() { return ++sessionVersion; }
    public String displayName() { return displayName; }
    public void displayName(String value) { displayName=value; }
    public void withdraw() { state = "WITHDRAWN"; displayName=null; invalidateSessions(); }
}
