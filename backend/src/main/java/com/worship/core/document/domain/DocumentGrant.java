package com.worship.core.document.domain;
import jakarta.persistence.*;
@Entity @Table(name="document_grant")
public class DocumentGrant {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;
    private long documentId;
    private long membershipId;
    private String role;
    protected DocumentGrant() {}
    public DocumentGrant(long workspaceId,long documentId,long memberId,String role){this.workspaceId=workspaceId;this.documentId=documentId;membershipId=memberId;this.role=role;}
    public long id(){return id;} public String role(){return role;} public void role(String role){this.role=role;}
}
