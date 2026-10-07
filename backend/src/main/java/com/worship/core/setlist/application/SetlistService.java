package com.worship.core.setlist.application;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import java.util.function.Consumer;
import tools.jackson.databind.json.JsonMapper;
import com.worship.core.document.domain.Document;
import com.worship.core.document.application.DocumentAuthorizationPolicy;
import com.worship.core.document.infrastructure.DocumentStore;
import com.worship.core.setlist.domain.*;
import com.worship.core.setlist.infrastructure.SetlistStore;
import com.worship.core.song.application.SongService;
import com.worship.core.song.infrastructure.SongStore;
import com.worship.core.shared.application.*;
import com.worship.core.score.application.ScoreService;
import com.worship.core.score.infrastructure.ScoreStore;
import com.worship.core.reference.application.ReferenceService;
import com.worship.core.reference.infrastructure.ReferenceStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static com.worship.core.document.application.DocumentAuthorizationPolicy.Action.*;
@Service
public class SetlistService {
    private final DocumentAuthorizationPolicy policy;private final DocumentStore documents;private final SetlistStore store;private final SongStore songs;private final SongService songViews;private final TransactionTemplate tx;private final Clock clock;
    private final JsonMapper json=JsonMapper.builder().build();
    private final ScoreStore scores;private final ScoreService scoreViews;private final ReferenceStore references;private final ReferenceService referenceViews;
    public SetlistService(DocumentAuthorizationPolicy policy,DocumentStore documents,SetlistStore store,SongStore songs,SongService songViews,TransactionTemplate tx,Clock clock,ScoreStore scores,ScoreService scoreViews,ReferenceStore references,ReferenceService referenceViews){this.policy=policy;this.documents=documents;this.store=store;this.songs=songs;this.songViews=songViews;this.tx=tx;this.clock=clock;this.scores=scores;this.scoreViews=scoreViews;this.references=references;this.referenceViews=referenceViews;}
    public record Block(String id,String section,int repeat,String cue,String calling,String note) {}
    public record SongForm(long version,List<Block> blocks) {}
    public record ItemView(long id,int position,SongService.SongView song,String key,BigDecimal bpm,List<String> sessions,String notes,SongForm songForm,ScoreService.ScoreView score,ReferenceService.ReferenceView reference) {}
    public record SetlistView(long id,long documentId,String title,long version,String notes,List<ItemView> items) {}
    private record Source(Document document,Setlist setlist) {}
    private Source source(Actor actor,long workspaceId,long documentId,boolean edit,long expected){var doc=policy.require(actor,workspaceId,documentId,edit?EDIT:READ);if(edit)policy.expectedVersion(doc,expected);var setlist=store.setlist(workspaceId,documentId);if(setlist==null)throw Errors.missing();return new Source(doc,setlist);}
    private SetlistView view(long workspaceId,Source source){return new SetlistView(source.setlist().id(),source.document().id(),source.document().title(),source.document().version(),source.setlist().notes(),store.items(workspaceId,source.setlist().id()).stream().map(item->itemView(workspaceId,item)).toList());}
    private ItemView itemView(long workspaceId,SetlistItem item){return new ItemView(item.id(),item.position(),songViews.view(songs.song(workspaceId,item.songId())),item.musicalKey(),item.bpm(),Arrays.asList(json.readValue(item.sessionsJson(),String[].class)),item.notes(),json.readValue(item.formJson(),SongForm.class),item.scoreId()==null?null:scoreViews.view(scores.score(workspaceId,item.scoreId())),item.referenceId()==null?null:referenceViews.view(references.reference(workspaceId,item.referenceId())));}
    public SetlistView get(Actor actor,long workspaceId,long documentId){return tx.execute(status->{var doc=policy.requireRead(actor,workspaceId,documentId);var setlist=store.setlist(workspaceId,documentId);if(setlist==null)throw Errors.missing();return view(workspaceId,new Source(doc,setlist));});}
    /** Command snapshot must retain exclusive guard and join the command's existing transaction. */
    @Transactional(propagation=Propagation.MANDATORY)
    public SetlistView getForCommand(Actor actor,long workspaceId,long documentId){return view(workspaceId,source(actor,workspaceId,documentId,false,0));}
    private SetlistView finish(long workspaceId,Source source){source.document().touch(clock.instant());documents.flush();return view(workspaceId,source);}
    public SetlistView update(Actor actor,long workspaceId,long documentId,String title,String notes,long expected){if(title==null||title.isBlank()||title.length()>200)throw Errors.invalid("Invalid title");text(notes,20000);return tx.execute(status->{var source=source(actor,workspaceId,documentId,true,expected);source.document().title(title.trim());source.setlist().notes(notes);return finish(workspaceId,source);});}
    public SetlistView add(Actor actor,long workspaceId,long documentId,long songId,long expected){return tx.execute(status->{var source=source(actor,workspaceId,documentId,true,expected);requireSong(workspaceId,songId);store.save(new SetlistItem(workspaceId,source.setlist().id(),songId,store.items(workspaceId,source.setlist().id()).size()));return finish(workspaceId,source);});}
    private void requireSong(long workspaceId,long songId){if(songs.song(workspaceId,songId)==null)throw Errors.missing();}
    private SetlistItem item(long workspaceId,Source source,long itemId){var item=store.item(workspaceId,source.setlist().id(),itemId);if(item==null)throw Errors.missing();return item;}
    public SetlistView remove(Actor actor,long workspaceId,long documentId,long itemId,long expected){return tx.execute(status->{var source=source(actor,workspaceId,documentId,true,expected);store.delete(item(workspaceId,source,itemId));store.flush();order(store.items(workspaceId,source.setlist().id()));return finish(workspaceId,source);});}
    public SetlistView reorder(Actor actor,long workspaceId,long documentId,List<Long> ids,long expected){if(ids==null)throw Errors.invalid("Ordered item IDs required");return tx.execute(status->{var source=source(actor,workspaceId,documentId,true,expected);var items=store.items(workspaceId,source.setlist().id());var byId=new HashMap<Long,SetlistItem>();items.forEach(i->byId.put(i.id(),i));if(ids.size()!=items.size()||new HashSet<>(ids).size()!=ids.size()||!byId.keySet().equals(new HashSet<>(ids)))throw Errors.invalid("Order must contain every current item exactly once");order(ids.stream().map(byId::get).toList());return finish(workspaceId,source);});}
    private void order(List<SetlistItem> items){int offset=items.stream().mapToInt(SetlistItem::position).max().orElse(0)+items.size()+1;for(int i=0;i<items.size();i++)items.get(i).position(offset+i);store.flush();for(int i=0;i<items.size();i++)items.get(i).position(i);store.flush();}
    private SetlistView changeItem(Actor actor,long workspaceId,long documentId,long itemId,long expected,Consumer<SetlistItem> change){return tx.execute(status->{var source=source(actor,workspaceId,documentId,true,expected);change.accept(item(workspaceId,source,itemId));return finish(workspaceId,source);});}
    public SetlistView selectSong(Actor actor,long workspaceId,long documentId,long itemId,long songId,long expected){return changeItem(actor,workspaceId,documentId,itemId,expected,i->{requireSong(workspaceId,songId);i.song(songId);});}
    public SetlistView settings(Actor actor,long workspaceId,long documentId,long itemId,String key,BigDecimal bpm,List<String> sessions,long expected){if(key!=null&&key.length()>32||bpm!=null&&(bpm.signum()<=0||bpm.compareTo(new BigDecimal("9999.99"))>0||bpm.scale()>2)||sessions==null||sessions.size()>32||sessions.stream().anyMatch(s->s==null||s.isBlank()||s.length()>64))throw Errors.invalid("Invalid musical settings");return changeItem(actor,workspaceId,documentId,itemId,expected,i->i.settings(key,bpm,json.writeValueAsString(sessions)));}
    public SetlistView notes(Actor actor,long workspaceId,long documentId,long itemId,String notes,long expected){text(notes,20000);return changeItem(actor,workspaceId,documentId,itemId,expected,i->i.notes(notes));}
    public SetlistView selectScore(Actor actor,long workspaceId,long documentId,long itemId,Long scoreId,long expected){return changeItem(actor,workspaceId,documentId,itemId,expected,i->{if(scoreId!=null&&scores.score(workspaceId,scoreId)==null)throw Errors.missing();i.score(scoreId);});}
    public SetlistView selectReference(Actor actor,long workspaceId,long documentId,long itemId,Long referenceId,long expected){return changeItem(actor,workspaceId,documentId,itemId,expected,i->{if(referenceId!=null&&references.reference(workspaceId,referenceId)==null)throw Errors.missing();i.reference(referenceId);});}
    public SetlistView songForm(Actor actor,long workspaceId,long documentId,long itemId,List<Block> blocks,long expected){
        if(blocks==null||blocks.size()>256)throw Errors.invalid("Invalid SongForm");Set<String> ids=new HashSet<>();
        for(var block:blocks){if(block==null||block.id()==null||block.id().isBlank()||block.id().length()>64||!ids.add(block.id())||block.section()==null||block.section().isBlank()||block.section().length()>64||block.repeat()<1||block.repeat()>1000)throw Errors.invalid("Invalid SongForm block");optionalText(block.cue(),2000);optionalText(block.calling(),2000);optionalText(block.note(),2000);}
        return changeItem(actor,workspaceId,documentId,itemId,expected,i->{var old=json.readValue(i.formJson(),SongForm.class);i.form(json.writeValueAsString(new SongForm(old.version()+1,List.copyOf(blocks))));});
    }
    private void text(String text,int max){if(text==null||text.length()>max)throw Errors.invalid("Invalid text");}
    private void optionalText(String text,int max){if(text!=null&&text.length()>max)throw Errors.invalid("Text too long");}
}
