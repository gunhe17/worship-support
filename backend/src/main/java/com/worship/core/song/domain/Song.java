package com.worship.core.song.domain;
import jakarta.persistence.*;
@Entity @Table(name="song")
public class Song {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;private String title;private String artist;
    protected Song() {}
    public Song(long workspaceId,String title,String artist){this.workspaceId=workspaceId;this.title=title;this.artist=artist;}
    public long id(){return id;}public String title(){return title;}public String artist(){return artist;}
}
