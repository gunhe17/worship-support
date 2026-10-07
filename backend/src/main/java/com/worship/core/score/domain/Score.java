package com.worship.core.score.domain;
import jakarta.persistence.*;
@Entity @Table(name="score")
public class Score {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;private Long songId;private String objectKey;private String filename;private String mediaType;private long byteSize;
    protected Score() {}
    public Score(long workspaceId,Long songId,String key,String filename,String media,long size){this.workspaceId=workspaceId;this.songId=songId;objectKey=key;this.filename=filename;mediaType=media;byteSize=size;}
    public long id(){return id;}public Long songId(){return songId;}public String key(){return objectKey;}public String filename(){return filename;}public String media(){return mediaType;}public long size(){return byteSize;}
}
