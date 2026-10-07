package com.worship.core.workspace.domain;
import jakarta.persistence.*;
@Entity @Table(name="workspace_membership")
public class Membership {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;
    private long userId;
    private String role;
    private String state;
    private String endReason;
    // Existing DB-generated column; only used to target the active_membership unique index.
    @Column(name="active_user",insertable=false,updatable=false)
    private Long activeUser;
    protected Membership() {}
    public Membership(long workspaceId,long userId,String role){this.workspaceId=workspaceId;this.userId=userId;this.role=role;state="ACTIVE";}
    public long id(){return id;} public long workspaceId(){return workspaceId;} public long userId(){return userId;}
    public String role(){return role;} public String state(){return state;} public boolean active(){return "ACTIVE".equals(state);}
    public boolean admin(){return active()&&"ADMIN".equals(role);}
    public void promote(){role="ADMIN";} public void releaseAdmin(){role="MEMBER";} public void end(String reason){state="ENDED";endReason=reason;}
}
