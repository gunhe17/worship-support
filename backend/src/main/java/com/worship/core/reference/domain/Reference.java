package com.worship.core.reference.domain;
import jakarta.persistence.*;
@Entity @Table(name="song_reference")
public class Reference {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;private String url;private String title;private String videoId;
    protected Reference(){}
    public Reference(long workspaceId,String url,String title,String videoId){this.workspaceId=workspaceId;this.url=url;this.title=title;this.videoId=videoId;}
    public long id(){return id;}public String url(){return url;}public String title(){return title;}public String videoId(){return videoId;}
}
