package com.worship.core.identity.domain;
import jakarta.persistence.*;
@Entity @Table(name = "external_identity")
public class ExternalIdentity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private long userId;
    private String issuer;
    private String subject;
    protected ExternalIdentity() {}
    public ExternalIdentity(long userId, String issuer, String subject) { this.userId = userId; this.issuer = issuer; this.subject = subject; }
    public long id() { return id; }
    public long userId() { return userId; }
}
