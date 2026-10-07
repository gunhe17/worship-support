package com.worship.core.song.application;
import java.util.List;
import com.worship.core.song.domain.Song;
import com.worship.core.song.infrastructure.SongStore;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
@Service
public class SongService {
    private final WorkspaceService workspace;private final SongStore store;private final SongCandidateSearch search;private final TransactionTemplate tx;
    public SongService(WorkspaceService workspace,SongStore store,SongCandidateSearch search,TransactionTemplate tx){this.workspace=workspace;this.store=store;this.search=search;this.tx=tx;}
    public record SongView(long id,String title,String artist) {}
    public SongView view(Song song){return new SongView(song.id(),song.title(),song.artist());}
    public SongView register(Actor actor,long workspaceId,String title,String artist){if(title==null||title.isBlank()||title.length()>200||artist!=null&&artist.length()>200)throw Errors.invalid("Invalid song metadata");return tx.execute(status->{workspace.requireMember(actor,workspaceId);var song=new Song(workspaceId,title.trim(),artist);store.save(song);return view(song);});}
    public List<SongView> list(Actor actor,long workspaceId){return tx.execute(status->{workspace.requireMemberForRead(actor,workspaceId);return store.list(workspaceId).stream().map(this::view).toList();});}
    public List<SongCandidateSearch.Candidate> search(Actor actor,long workspaceId,String query){if(query==null||query.isBlank()||query.length()>200)throw Errors.invalid("Search query required");tx.executeWithoutResult(status->workspace.requireMemberForRead(actor,workspaceId));var candidates=List.copyOf(search.search(query));tx.executeWithoutResult(status->workspace.requireMemberForRead(actor,workspaceId));return candidates;}
}
