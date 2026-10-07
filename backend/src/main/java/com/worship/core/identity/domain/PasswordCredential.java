package com.worship.core.identity.domain;
import jakarta.persistence.*;
@Entity @Table(name = "password_credential")
public class PasswordCredential {
    @Id private long userId;
    private String passwordHash;
    protected PasswordCredential() {}
    public PasswordCredential(long userId, String hash) { this.userId = userId; passwordHash = hash; }
    public String hash() { return passwordHash; }
    public void replace(String hash) { passwordHash = hash; }
}
