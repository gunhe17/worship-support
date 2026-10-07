package com.worship.core.integration.youtube;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class YouTubeStore {
    private final JdbcTemplate jdbc;
    public YouTubeStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<String> runningRevisions(long workspaceId){return jdbc.query("SELECT id,attempt_id FROM playlist_command WHERE workspace_id=? AND status='RUNNING' ORDER BY id",(r,n)->r.getLong(1)+"@"+r.getString(2),workspaceId);}
    public record Authorization(long id,String encryptedRefresh) {}
    public Authorization authorization(long userId){var rows=jdbc.query("SELECT id,encrypted_refresh FROM youtube_authorization WHERE user_id=?",(r,n)->new Authorization(r.getLong(1),r.getString(2)),userId);return rows.isEmpty()?null:rows.getFirst();}
    public void connect(long userId,String encrypted){disconnect(userId);jdbc.update("INSERT INTO youtube_authorization(user_id,encrypted_refresh) VALUES(?,?)",userId,encrypted);}
    public void disconnect(long userId){jdbc.update("DELETE FROM youtube_authorization WHERE user_id=?",userId);jdbc.update("UPDATE youtube_oauth_intent SET consumed=TRUE,cancelled=TRUE WHERE user_id=?",userId);}
    public void intent(long userId,long version,String hash,String verifier,Instant expires){jdbc.update("INSERT INTO youtube_oauth_intent(user_id,session_version,state_hash,encrypted_verifier,expires_at) VALUES(?,?,?,?,?)",userId,version,hash,verifier,LocalDateTime.ofInstant(expires,ZoneOffset.UTC));}
    public record Intent(long userId,long version,String verifier,Instant expires,boolean consumed,boolean cancelled) {}
    public Intent intent(String hash){var rows=jdbc.query("SELECT user_id,session_version,encrypted_verifier,expires_at,consumed,cancelled FROM youtube_oauth_intent WHERE state_hash=? FOR UPDATE",(r,n)->new Intent(r.getLong(1),r.getLong(2),r.getString(3),r.getObject(4,LocalDateTime.class).toInstant(ZoneOffset.UTC),r.getBoolean(5),r.getBoolean(6)),hash);return rows.isEmpty()?null:rows.getFirst();}
    public void consume(String hash){jdbc.update("UPDATE youtube_oauth_intent SET consumed=TRUE WHERE state_hash=?",hash);}
    public record Command(long id,long documentId,long actorId,long authorizationId,String requestHash,String marker,long version,String snapshot,String playlistId,String status,Instant startedAt,String attempt) {}
    private Command row(java.sql.ResultSet r,int ignored)throws java.sql.SQLException{return new Command(r.getLong("id"),r.getLong("document_id"),r.getLong("actor_id"),r.getLong("authorization_id"),r.getString("request_hash"),r.getString("marker"),r.getLong("source_version"),r.getString("canonical_json"),r.getString("playlist_id"),r.getString("status"),r.getObject("started_at",LocalDateTime.class).toInstant(ZoneOffset.UTC),r.getString("attempt_id"));}
    public Command command(long workspaceId,String key){var rows=jdbc.query("SELECT * FROM playlist_command WHERE workspace_id=? AND command_key=? FOR UPDATE",this::row,workspaceId,key);return rows.isEmpty()?null:rows.getFirst();}
    public void create(long workspaceId,long documentId,long actorId,long authorizationId,String key,String hash,String marker,long version,String snapshot,String playlistId,Instant now){jdbc.update("INSERT INTO playlist_command(workspace_id,document_id,actor_id,authorization_id,command_key,request_hash,marker,source_version,canonical_json,playlist_id,status,started_at,attempt_id) VALUES(?,?,?,?,?,?,?,?,?,?,'RUNNING',?,?)",workspaceId,documentId,actorId,authorizationId,key,hash,marker,version,snapshot,playlistId,LocalDateTime.ofInstant(now,ZoneOffset.UTC),UUID.randomUUID().toString());}
    public void claim(long workspaceId,String key,Instant now){jdbc.update("UPDATE playlist_command SET status='RUNNING',started_at=?,attempt_id=? WHERE workspace_id=? AND command_key=? AND status<>'SUCCEEDED'",LocalDateTime.ofInstant(now,ZoneOffset.UTC),UUID.randomUUID().toString(),workspaceId,key);}
    public void status(long workspaceId,String key,String attempt,String status,String playlistId,Instant now){jdbc.update("UPDATE playlist_command SET status=?,playlist_id=?,started_at=? WHERE workspace_id=? AND command_key=? AND attempt_id=? AND status='RUNNING'",status,playlistId,LocalDateTime.ofInstant(now,ZoneOffset.UTC),workspaceId,key,attempt);}
}
