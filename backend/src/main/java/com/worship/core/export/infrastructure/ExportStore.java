package com.worship.core.export.infrastructure;

import java.time.*;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ExportStore {
    private final JdbcTemplate jdbc;
    public ExportStore(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<String> runningRevisions(long workspaceId){return jdbc.query("SELECT id,attempt_id FROM immutable_export WHERE workspace_id=? AND status='RUNNING' ORDER BY id",(r,n)->r.getLong(1)+"@"+r.getString(2),workspaceId);}
    public record Snapshot(long id,long workspaceId,long documentId,long actorId,String key,long version,String canonical,String snapshotHash,Instant createdAt,String status,String attempt,Instant startedAt,String objectKey,String artifactHash,Long byteSize) {}
    private final RowMapper<Snapshot> mapper=(r,n)->new Snapshot(r.getLong("id"),r.getLong("workspace_id"),r.getLong("document_id"),r.getLong("actor_id"),r.getString("command_key"),r.getLong("source_version"),r.getString("canonical_json"),r.getString("snapshot_hash"),r.getObject("created_at",LocalDateTime.class).toInstant(ZoneOffset.UTC),r.getString("status"),r.getString("attempt_id"),r.getObject("started_at",LocalDateTime.class).toInstant(ZoneOffset.UTC),r.getString("object_key"),r.getString("artifact_hash"),r.getObject("byte_size",Long.class));
    private Snapshot one(List<Snapshot> values){return values.isEmpty()?null:values.getFirst();}
    public Snapshot command(long workspaceId,String key){return one(jdbc.query("SELECT * FROM immutable_export WHERE workspace_id=? AND command_key=? FOR UPDATE",mapper,workspaceId,key));}
    public Snapshot get(long workspaceId,long documentId,long id){return one(jdbc.query("SELECT * FROM immutable_export WHERE workspace_id=? AND document_id=? AND id=?",mapper,workspaceId,documentId,id));}
    public List<Snapshot> list(long workspaceId,long documentId){return jdbc.query("SELECT * FROM immutable_export WHERE workspace_id=? AND document_id=? ORDER BY id",mapper,workspaceId,documentId);}
    public void create(long workspaceId,long documentId,long actorId,String key,long version,String canonical,String hash,String attempt,Instant now){jdbc.update("INSERT INTO immutable_export(workspace_id,document_id,actor_id,command_key,source_version,canonical_json,snapshot_hash,created_at,status,attempt_id,started_at) VALUES(?,?,?,?,?,?,?,?, 'RUNNING',?,?)",workspaceId,documentId,actorId,key,version,canonical,hash,LocalDateTime.ofInstant(now,ZoneOffset.UTC),attempt,LocalDateTime.ofInstant(now,ZoneOffset.UTC));}
    public void claim(long workspaceId,long id,String attempt,Instant now){jdbc.update("UPDATE immutable_export SET status='RUNNING',attempt_id=?,started_at=? WHERE workspace_id=? AND id=? AND status<>'SUCCEEDED'",attempt,LocalDateTime.ofInstant(now,ZoneOffset.UTC),workspaceId,id);}
    public boolean complete(long workspaceId,long id,String attempt,String objectKey,String hash,long size){return jdbc.update("UPDATE immutable_export SET status='SUCCEEDED',object_key=?,artifact_hash=?,byte_size=? WHERE workspace_id=? AND id=? AND attempt_id=? AND status='RUNNING'",objectKey,hash,size,workspaceId,id,attempt)==1;}
    public void failed(long workspaceId,long id,String attempt){jdbc.update("UPDATE immutable_export SET status='FAILED_RETRYABLE' WHERE workspace_id=? AND id=? AND attempt_id=? AND status='RUNNING'",workspaceId,id,attempt);}
    public void cleanupFailed(long workspaceId,String objectKey,Instant now){jdbc.update("INSERT INTO storage_cleanup_failure(workspace_id,object_key,occurred_at) VALUES(?,?,?)",workspaceId,objectKey,LocalDateTime.ofInstant(now,ZoneOffset.UTC));}
}
