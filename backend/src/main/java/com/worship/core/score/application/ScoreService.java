package com.worship.core.score.application;
import java.time.Clock;
import java.util.*;
import com.worship.core.integration.storage.ObjectStorage;
import com.worship.core.score.domain.Score;
import com.worship.core.score.infrastructure.ScoreStore;
import com.worship.core.song.infrastructure.SongStore;
import com.worship.core.workspace.application.WorkspaceService;
import com.worship.core.shared.application.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
@Service
public class ScoreService {
    private final ObjectStorage storage;private final ScoreFileValidator files;private final WorkspaceService workspace;private final ScoreStore store;private final SongStore songs;private final TransactionTemplate tx;private final Clock clock;
    public ScoreService(ObjectStorage storage,ScoreFileValidator files,WorkspaceService workspace,ScoreStore store,SongStore songs,TransactionTemplate tx,Clock clock){this.storage=storage;this.files=files;this.workspace=workspace;this.store=store;this.songs=songs;this.tx=tx;this.clock=clock;}
    public record ScoreView(long id,Long songId,String filename,String mediaType,long byteSize) {}
    public record Download(ScoreView metadata,byte[] bytes) {}
    private record DownloadSource(ScoreView metadata,String objectKey) {}
    public ScoreView view(Score s){return new ScoreView(s.id(),s.songId(),s.filename(),s.media(),s.size());}
    private void authorize(Actor actor,long workspaceId,Long songId){workspace.requireMember(actor,workspaceId);if(songId!=null&&songs.song(workspaceId,songId)==null)throw Errors.missing();}
    public ScoreView upload(Actor actor,long workspaceId,Long songId,String filename,String media,byte[] bytes){
        tx.executeWithoutResult(status->authorize(actor,workspaceId,songId));files.validate(filename,media,bytes);String key="workspace/"+workspaceId+"/score/"+UUID.randomUUID();
        try{storage.put(key,bytes,media);return tx.execute(status->{authorize(actor,workspaceId,songId);var score=new Score(workspaceId,songId,key,filename,media,bytes.length);store.save(score);return view(score);});}
        catch(RuntimeException failure){try{storage.delete(key);}catch(RuntimeException cleanup){try{tx.executeWithoutResult(status->store.cleanupFailed(workspaceId,key,clock.instant()));}catch(RuntimeException recording){org.slf4j.LoggerFactory.getLogger(ScoreService.class).error("Storage compensation could not be recorded: workspace={}, objectKey={}",workspaceId,key);}failure.addSuppressed(cleanup);}throw failure;}
    }
    public List<ScoreView> list(Actor actor,long workspaceId){return tx.execute(status->{workspace.requireMemberForRead(actor,workspaceId);return store.list(workspaceId).stream().map(this::view).toList();});}
    public Download download(Actor actor,long workspaceId,long scoreId){
        DownloadSource source=tx.execute(status->{
            workspace.requireMemberForRead(actor,workspaceId);
            var score=store.score(workspaceId,scoreId);
            if(score==null)throw Errors.missing();
            return new DownloadSource(view(score),score.key());
        });
        byte[] bytes=storage.get(source.objectKey());
        // Storage I/O must not hold DB locks. Recheck the account/session and current
        // membership after it, as Export downloads do, before handing bytes to HTTP.
        tx.executeWithoutResult(status->workspace.requireMemberForRead(actor,workspaceId));
        return new Download(source.metadata(),bytes);
    }
}
