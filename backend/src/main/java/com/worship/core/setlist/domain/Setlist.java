package com.worship.core.setlist.domain;
import jakarta.persistence.*;
@Entity @Table(name="setlist")
public class Setlist {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;
    private long documentId;
    @Column(columnDefinition="TEXT") private String notes;
    protected Setlist() {}
    public Setlist(long workspaceId,long documentId){this.workspaceId=workspaceId;this.documentId=documentId;notes="";}
    public long id(){return id;} public long documentId(){return documentId;} public String notes(){return notes;}
    public void notes(String notes){this.notes=notes;}
}
