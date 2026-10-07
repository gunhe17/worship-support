package com.worship.core.identity.domain;
import java.time.Instant;
import jakarta.persistence.*;
@Entity @Table(name = "account_token")
public class AccountToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private long userId;
    private Long emailId;
    private String kind;
    private String tokenHash;
    private Instant expiresAt;
    private boolean consumed;
    protected AccountToken() {}
    public AccountToken(long userId, Long emailId, String kind, String hash, Instant expiresAt) {
        this.userId = userId; this.emailId = emailId; this.kind = kind; tokenHash = hash; this.expiresAt = expiresAt;
    }
    public long userId() { return userId; }
    public Long emailId() { return emailId; }
    public boolean usable(String requiredKind, Instant now) { return kind.equals(requiredKind) && !consumed && expiresAt.isAfter(now); }
    public void consume() { consumed = true; }
}
