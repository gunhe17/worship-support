package com.worship.core.document.domain;
import java.time.Instant;
import jakarta.persistence.*;
@Entity @Table(name="document")
public class Document {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;
    private String title;
    private String type;
    private String accessPolicy;
    @Version private long version;
    private Instant modifiedAt;
    protected Document() {}
    public Document(long workspaceId,String title,String policy,Instant now){this.workspaceId=workspaceId;this.title=title;accessPolicy=policy;type="SETLIST";modifiedAt=now;}
    public long id(){return id;} public long workspaceId(){return workspaceId;} public String title(){return title;}
    public String type(){return type;} public String accessPolicy(){return accessPolicy;} public long version(){return version;}
    public void access(String policy){accessPolicy=policy;} public void title(String title){this.title=title;}
    public void touch(Instant now){modifiedAt=now.isAfter(modifiedAt)?now:modifiedAt.plusNanos(1000);}
}
