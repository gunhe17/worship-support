package com.worship.core.export.application;

import java.security.*;
import java.time.*;
import java.util.*;
import com.worship.core.document.application.DocumentAuthorizationPolicy;
import com.worship.core.export.infrastructure.ExportStore;
import com.worship.core.integration.storage.ObjectStorage;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.score.application.ScoreService;
import com.worship.core.shared.application.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ExportService implements com.worship.core.workspace.application.WorkspaceTerminationParticipant {
    @Override public Impact terminationImpact(long workspaceId){var running=store.runningRevisions(workspaceId);return new Impact("export",0,!running.isEmpty(),running);}
    private final DocumentAuthorizationPolicy policy;private final SetlistService setlists;private final ExportStore store;private final ExportRenderer renderer;private final ObjectStorage storage;private final TransactionTemplate tx;private final Clock clock;
    private final JsonMapper json=JsonMapper.builder().build();
    private final ScoreService scores;
    private final long maxInputBytes;
    public ExportService(DocumentAuthorizationPolicy policy,SetlistService setlists,ExportStore store,ExportRenderer renderer,ObjectStorage storage,TransactionTemplate tx,Clock clock,ScoreService scores,@Value("${worship.exports.max-input-bytes:104857600}") long maxInputBytes){this.policy=policy;this.setlists=setlists;this.store=store;this.renderer=renderer;this.storage=storage;this.tx=tx;this.clock=clock;this.scores=scores;if(maxInputBytes<=0)throw new IllegalArgumentException("Export input limit must be positive");this.maxInputBytes=maxInputBytes;}
    public record ExportView(long id,long documentId,long sourceVersion,String snapshotHash,Instant createdAt,String status,String artifactHash,Long byteSize) {}
    public record Download(ExportView metadata,byte[] bytes) {}
    private record Work(ExportStore.Snapshot snapshot,String attempt,boolean execute) {}
    private ExportView view(ExportStore.Snapshot s){return new ExportView(s.id(),s.documentId(),s.version(),s.snapshotHash(),s.createdAt(),s.status(),s.artifactHash(),s.byteSize());}
    private ExportStore.Snapshot require(Actor actor,long w,long d,long id){policy.requireRead(actor,w,d);var found=store.get(w,d,id);if(found==null)throw Errors.missing();return found;}
    public ExportView generate(Actor actor,long w,long d,long sourceVersion,String key){
        if(key==null||key.isBlank()||key.length()>100||sourceVersion<0)throw Errors.invalid("Invalid export command");
        Work work=tx.execute(status->{
            var document=policy.require(actor,w,d,DocumentAuthorizationPolicy.Action.EDIT);var prior=store.command(w,key);
            if(prior!=null){if(prior.documentId()!=d||prior.actorId()!=actor.userId()||prior.version()!=sourceVersion)throw Errors.conflict("Export command key reused");if("SUCCEEDED".equals(prior.status())||"RUNNING".equals(prior.status())&&prior.startedAt().plusSeconds(300).isAfter(clock.instant()))return new Work(prior,prior.attempt(),false);String attempt=UUID.randomUUID().toString();store.claim(w,prior.id(),attempt,clock.instant());return new Work(prior,attempt,true);}
            policy.expectedVersion(document,sourceVersion);String canonical=json.writeValueAsString(setlists.getForCommand(actor,w,d));String attempt=UUID.randomUUID().toString();store.create(w,d,actor.userId(),key,sourceVersion,canonical,hash(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)),attempt,clock.instant());return new Work(store.command(w,key),attempt,true);
        });
        if(!work.execute())return view(work.snapshot());
        String objectKey="workspace/"+w+"/export/"+work.snapshot().id()+"/"+work.attempt();boolean putAttempted=false,committed=false;
        try{
            var source=json.readValue(work.snapshot().canonical(),SetlistService.SetlistView.class);
            byte[] bytes=renderer.pdf(source,scoreContents(actor,w,source));
            if(bytes==null||bytes.length==0)throw new IllegalStateException("Renderer returned empty PDF");
            putAttempted=true;storage.put(objectKey,bytes,"application/pdf");
            committed=Boolean.TRUE.equals(tx.execute(status->{policy.require(actor,w,d,DocumentAuthorizationPolicy.Action.EDIT);return store.complete(w,work.snapshot().id(),work.attempt(),objectKey,hash(bytes),bytes.length);}));
        }catch(RuntimeException failure){tx.executeWithoutResult(status->store.failed(w,work.snapshot().id(),work.attempt()));}
        finally{if(putAttempted&&!committed)compensate(w,objectKey);}
        return get(actor,w,d,work.snapshot().id());
    }
    private void compensate(long w,String key){try{storage.delete(key);}catch(RuntimeException cleanup){try{tx.executeWithoutResult(status->store.cleanupFailed(w,key,clock.instant()));}catch(RuntimeException recording){org.slf4j.LoggerFactory.getLogger(ExportService.class).error("Export storage compensation could not be recorded: workspace={}, objectKey={}",w,key);}}}
    private Map<Long,ExportRenderer.ScoreContent> scoreContents(Actor actor,long workspaceId,SetlistService.SetlistView source){
        var contents=new LinkedHashMap<Long,ExportRenderer.ScoreContent>();
        long total=0;
        for(var item:source.items()){
            var selected=item.score();
            if(selected==null||contents.containsKey(selected.id()))continue;
            // Immutable Score IDs/keys, not current Setlist selection, define retry input.
            if(selected.byteSize()<=0||selected.byteSize()>maxInputBytes-total)
                throw new IllegalStateException("Export score input limit exceeded");
            var download=scores.download(actor,workspaceId,selected.id());
            if(!selected.equals(download.metadata())||download.bytes().length!=selected.byteSize())
                throw new IllegalStateException("Snapshot score metadata does not match stored input");
            total+=download.bytes().length;
            contents.put(selected.id(),new ExportRenderer.ScoreContent(selected.mediaType(),download.bytes()));
        }
        return Map.copyOf(contents);
    }
    public ExportView get(Actor actor,long w,long d,long id){return tx.execute(status->view(require(actor,w,d,id)));}
    public List<ExportView> list(Actor actor,long w,long d){return tx.execute(status->{policy.requireRead(actor,w,d);return store.list(w,d).stream().map(this::view).toList();});}
    public Download download(Actor actor,long w,long d,long id){var snapshot=tx.execute(status->require(actor,w,d,id));if(!"SUCCEEDED".equals(snapshot.status()))throw Errors.conflict("Export is not ready");byte[] bytes=storage.get(snapshot.objectKey());if(!hash(bytes).equals(snapshot.artifactHash()))throw new CapabilityException(503,"EXPORT_INTEGRITY_FAILURE","Stored export failed integrity verification");tx.executeWithoutResult(status->require(actor,w,d,id));return new Download(view(snapshot),bytes);}
    private String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
