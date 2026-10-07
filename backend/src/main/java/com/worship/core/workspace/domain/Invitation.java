package com.worship.core.workspace.domain;
import java.time.Instant;
import jakarta.persistence.*;
@Entity @Table(name="workspace_invitation")
public class Invitation {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;
    private long inviterId;
    private String email;
    private String tokenHash;
    private String state;
    private Instant expiresAt;
    private String deliveryStatus;
    protected Invitation() {}
    public Invitation(long workspaceId,long actor,String email,String hash,Instant expiry){this.workspaceId=workspaceId;inviterId=actor;this.email=email;tokenHash=hash;expiresAt=expiry;state="PENDING";deliveryStatus="PENDING";}
    public long id(){return id;} public long workspaceId(){return workspaceId;} public String email(){return email;}
    public String state(){return state;} public String deliveryStatus(){return deliveryStatus;}
    public boolean expired(Instant now){return !expiresAt.isAfter(now);}
    public void state(String state){this.state=state;} public void delivery(String status){deliveryStatus=status;}
    public void rotate(String hash,Instant expiry){tokenHash=hash;expiresAt=expiry;deliveryStatus="PENDING";}
    public boolean matchesToken(String hash){return tokenHash.equals(hash);}
}
