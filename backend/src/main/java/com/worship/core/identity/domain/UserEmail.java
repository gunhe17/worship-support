package com.worship.core.identity.domain;
import jakarta.persistence.*;
@Entity @Table(name = "user_email")
public class UserEmail {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private long userId;
    private String email;
    private boolean verified;
    @Column(name = "primary_email") private boolean primary;
    protected UserEmail() {}
    public UserEmail(long userId, String email, boolean primary, boolean verified) {
        this.userId = userId; this.email = email; this.primary = primary; this.verified = verified;
    }
    public long id() { return id; }
    public long userId() { return userId; }
    public String email() { return email; }
    public boolean verified() { return verified; }
    public boolean primary() { return primary; }
    public void verify() { verified = true; }
    public void primary(boolean primary) { this.primary = primary; }
}
