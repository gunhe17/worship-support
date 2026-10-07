package com.worship.core.reference.application;
import java.net.*;
import java.util.*;
import com.worship.core.reference.domain.Reference;
import com.worship.core.reference.infrastructure.ReferenceStore;
import com.worship.core.integration.youtube.VideoSearch;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
@Service
public class ReferenceService {
    private final ReferenceStore store;private final WorkspaceService workspace;private final VideoSearch search;private final TransactionTemplate tx;
    public ReferenceService(ReferenceStore store,WorkspaceService workspace,VideoSearch search,TransactionTemplate tx){this.store=store;this.workspace=workspace;this.search=search;this.tx=tx;}
    public record ReferenceView(long id,String url,String title,String videoId) {}
    public ReferenceView view(Reference reference){return new ReferenceView(reference.id(),reference.url(),reference.title(),reference.videoId());}
    private String url(String raw){if(raw==null||raw.length()>2048)throw Errors.invalid("Invalid Reference URL");try{var uri=new URI(raw);if(uri.getScheme()==null||!Set.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw Errors.invalid("Reference must be an absolute HTTP(S) URL");String value=uri.toASCIIString();if(value.length()>2048)throw Errors.invalid("Reference URL too long");return value;}catch(URISyntaxException e){throw Errors.invalid("Invalid Reference URL");}}
    public ReferenceView register(Actor actor,long workspaceId,String raw,String title){String url=url(raw);if(title!=null&&title.length()>200)throw Errors.invalid("Reference title too long");return tx.execute(status->{workspace.requireMember(actor,workspaceId);var reference=new Reference(workspaceId,url,title,videoId(url));store.save(reference);return view(reference);});}
    public ReferenceView registerVideo(Actor actor,long workspaceId,String videoId,String title){if(videoId==null||!videoId.matches("[A-Za-z0-9_-]{11}"))throw Errors.invalid("Invalid YouTube video ID");return register(actor,workspaceId,"https://www.youtube.com/watch?v="+videoId,title);}
    public List<ReferenceView> list(Actor actor,long workspaceId){return tx.execute(status->{workspace.requireMemberForRead(actor,workspaceId);return store.list(workspaceId).stream().map(this::view).toList();});}
    public List<VideoSearch.Video> search(Actor actor,long workspaceId,String query){if(query==null||query.isBlank()||query.length()>200)throw Errors.invalid("Search query required");tx.executeWithoutResult(status->workspace.requireMemberForRead(actor,workspaceId));var candidates=List.copyOf(search.search(query));tx.executeWithoutResult(status->workspace.requireMemberForRead(actor,workspaceId));return candidates;}
    private String videoId(String url){var uri=URI.create(url);String host=uri.getHost().toLowerCase(Locale.ROOT);String candidate=null;if("youtu.be".equals(host)&&uri.getPath().length()>1)candidate=uri.getPath().substring(1);else if(Set.of("youtube.com","www.youtube.com","m.youtube.com").contains(host)&&uri.getRawQuery()!=null)for(var pair:uri.getRawQuery().split("&"))if(pair.startsWith("v="))candidate=pair.substring(2);return candidate!=null&&candidate.matches("[A-Za-z0-9_-]{11}")?candidate:null;}
}
