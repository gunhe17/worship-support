package com.worship.core.workspace.domain;
import java.time.Instant;
import jakarta.persistence.*;
@Entity @Table(name="workspace")
public class Workspace {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private String name;
    private Instant createdAt;
    private String state="ACTIVE";
    private Instant terminatedAt;
    protected Workspace() {}
    public Workspace(String name,Instant now){this.name=name;createdAt=now;}
    public long id(){return id;} public String name(){return name;}
    public boolean active(){return "ACTIVE".equals(state);}
    public Instant terminatedAt(){return terminatedAt;}
    public void terminate(Instant now){state="TERMINATED";terminatedAt=now;}
}
