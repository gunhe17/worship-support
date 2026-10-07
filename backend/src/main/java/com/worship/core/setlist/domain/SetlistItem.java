package com.worship.core.setlist.domain;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name="setlist_item")
public class SetlistItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private long workspaceId;private long setlistId;private long songId;private int position;
    private String musicalKey;private BigDecimal bpm;
    private Long scoreId;private Long referenceId;
    @Column(columnDefinition="LONGTEXT") private String sessionsJson;
    @Column(columnDefinition="TEXT") private String notes;
    @Column(columnDefinition="LONGTEXT") private String formJson;
    protected SetlistItem() {}
    public SetlistItem(long workspaceId,long setlistId,long songId,int position){this.workspaceId=workspaceId;this.setlistId=setlistId;this.songId=songId;this.position=position;sessionsJson="[]";notes="";formJson="{\"version\":0,\"blocks\":[]}";}
    public long id(){return id;}public long songId(){return songId;}public int position(){return position;}public String musicalKey(){return musicalKey;}public BigDecimal bpm(){return bpm;}public String sessionsJson(){return sessionsJson;}public String notes(){return notes;}public String formJson(){return formJson;}
    public void position(int value){position=value;}public void song(long id){songId=id;}
    public void settings(String key,BigDecimal bpm,String sessionsJson){musicalKey=key;this.bpm=bpm;this.sessionsJson=sessionsJson;}
    public void notes(String value){notes=value;}public void form(String value){formJson=value;}
    public Long scoreId(){return scoreId;}public Long referenceId(){return referenceId;}
    public void score(Long id){scoreId=id;}public void reference(Long id){referenceId=id;}
}
