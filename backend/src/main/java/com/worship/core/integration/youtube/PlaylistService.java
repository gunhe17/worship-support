package com.worship.core.integration.youtube;
import java.time.Clock;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import com.worship.core.document.application.DocumentAuthorizationPolicy;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.shared.application.*;
import com.worship.core.identity.application.IdentityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
@Service
public class PlaylistService implements com.worship.core.workspace.application.WorkspaceTerminationParticipant {
    @Override public Impact terminationImpact(long workspaceId){var running=store.runningRevisions(workspaceId);return new Impact("playlist",0,!running.isEmpty(),running);}
    private final YouTubeAuthorizationService authorizations;private final YouTubeStore store;private final YouTubeProvider provider;private final DocumentAuthorizationPolicy policy;private final SetlistService setlists;private final TransactionTemplate tx;private final Clock clock;private final JsonMapper json=JsonMapper.builder().build();
    public PlaylistService(YouTubeAuthorizationService authorizations,YouTubeStore store,YouTubeProvider provider,DocumentAuthorizationPolicy policy,SetlistService setlists,TransactionTemplate tx,Clock clock){this.authorizations=authorizations;this.store=store;this.provider=provider;this.policy=policy;this.setlists=setlists;this.tx=tx;this.clock=clock;}
    public record Result(long id,String playlistId,String status,long sourceVersion) {}
    private record Work(YouTubeStore.Command command,YouTubeStore.Authorization authorization,boolean execute,boolean reconcile) {}
    private Result view(YouTubeStore.Command c){return new Result(c.id(),c.playlistId(),c.status(),c.version());}
    public Result synchronize(Actor actor,long workspaceId,long documentId,String playlistId,long sourceVersion,String key){
        if(key==null||key.isBlank()||key.length()>100||playlistId!=null&&(playlistId.isBlank()||playlistId.length()>255||!playlistId.matches("[A-Za-z0-9_-]+")))throw Errors.invalid("Invalid playlist command");
        String hash=IdentityService.hash(documentId+":"+sourceVersion+":"+Objects.toString(playlistId,"CREATE"));
        Work work=tx.execute(status->{
            var document=policy.require(actor,workspaceId,documentId,DocumentAuthorizationPolicy.Action.EDIT);var auth=authorizations.require(actor);var prior=store.command(workspaceId,key);
            if(prior!=null){if(prior.actorId()!=actor.userId()||!prior.requestHash().equals(hash)||prior.documentId()!=documentId||prior.authorizationId()!=auth.id())throw Errors.conflict("Command key reused or authorization changed");if("SUCCEEDED".equals(prior.status()))return new Work(prior,auth,false,false);if("RUNNING".equals(prior.status())&&prior.startedAt().plusSeconds(300).isAfter(clock.instant()))return new Work(prior,auth,false,false);policy.expectedVersion(document,sourceVersion);boolean reconcile="UNCERTAIN".equals(prior.status())||"RUNNING".equals(prior.status());store.claim(workspaceId,key,clock.instant());return new Work(store.command(workspaceId,key),auth,true,reconcile);}
            policy.expectedVersion(document,sourceVersion);var snapshot=setlists.getForCommand(actor,workspaceId,documentId);store.create(workspaceId,documentId,actor.userId(),auth.id(),key,hash,UUID.randomUUID().toString(),sourceVersion,json.writeValueAsString(snapshot),playlistId,clock.instant());return new Work(store.command(workspaceId,key),auth,true,false);
        });
        if(!work.execute())return view(work.command());String target=work.command().playlistId();boolean creating=false;
        try{
            String access=provider.accessToken(authorizations.refresh(actor,work.authorization()));
            var snapshot=json.readValue(work.command().snapshot(),SetlistService.SetlistView.class);
            if(target==null){if(work.reconcile()){target=provider.findPlaylist(access,work.command().marker()).orElse(null);if(target==null){save(workspaceId,key,work.command().attempt(),"UNCERTAIN",null);return current(actor,workspaceId,documentId,key);}}else{active(actor,workspaceId,documentId,key,work,null);creating=true;target=provider.createPlaylist(access,snapshot.title(),work.command().marker());if(target==null||target.isBlank())throw new ProviderFailure(true);creating=false;}}
            String selected=target;active(actor,workspaceId,documentId,key,work,selected);
            List<String> videos=snapshot.items().stream().filter(i->i.reference()!=null&&i.reference().videoId()!=null).map(i->i.reference().videoId()).toList();provider.synchronize(access,target,videos,()->active(actor,workspaceId,documentId,key,work,selected));
            tx.executeWithoutResult(status->{active(actor,workspaceId,documentId,key,work,selected);store.status(workspaceId,key,work.command().attempt(),"SUCCEEDED",selected,clock.instant());});
        }catch(RuntimeException failure){boolean uncertain=target==null&&(work.reconcile()||creating&&(!(failure instanceof ProviderFailure pf)||pf.uncertain()));save(workspaceId,key,work.command().attempt(),uncertain?"UNCERTAIN":"FAILED_RETRYABLE",target);}
        return current(actor,workspaceId,documentId,key);
    }
    private void active(Actor actor,long w,long d,String key,Work work,String playlistId){tx.executeWithoutResult(status->{var auth=authorizations.require(actor);if(auth.id()!=work.authorization().id())throw Errors.forbidden();policy.require(actor,w,d,DocumentAuthorizationPolicy.Action.EDIT);var command=store.command(w,key);if(!command.attempt().equals(work.command().attempt())||!"RUNNING".equals(command.status()))throw Errors.conflict("Command attempt superseded");store.status(w,key,command.attempt(),"RUNNING",playlistId,clock.instant());});}
    private void save(long workspaceId,String key,String attempt,String status,String playlistId){tx.executeWithoutResult(txStatus->store.status(workspaceId,key,attempt,status,playlistId,clock.instant()));}
    private Result current(Actor actor,long workspaceId,long documentId,String key){return tx.execute(status->{policy.require(actor,workspaceId,documentId,DocumentAuthorizationPolicy.Action.EDIT);return view(store.command(workspaceId,key));});}
}
