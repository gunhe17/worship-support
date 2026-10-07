package com.worship.core;
import java.util.*;
import java.util.concurrent.*;
import java.math.BigDecimal;
import com.worship.core.document.application.DocumentService;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.song.application.*;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest @Testcontainers
@Import({SetlistIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class SetlistIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @TestConfiguration static class Fakes {@Bean @Primary FakeCandidates candidates(){return new FakeCandidates();}}
    static class FakeCandidates implements SongCandidateSearch {
        volatile Runnable afterSearch;
        public List<Candidate> search(String query){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();var callback=afterSearch;afterSearch=null;if(callback!=null)callback.run();return List.of();}
    }
    @Autowired FakeCandidates candidates;
    @Autowired DocumentService documents;@Autowired WorkspaceService workspace;@Autowired IdentityService identity;
    @Autowired SetlistService setlists;@Autowired SongService songs;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;@Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    @Autowired JdbcTemplate jdbc;
    Actor account(){String address=UUID.randomUUID()+"@example.org";identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    long join(Actor admin,long workspaceId,Actor user){String address=identity.get(user).emails().getFirst().email();workspace.invite(admin,workspaceId,address,UUID.randomUUID().toString());return workspace.accept(user,invitations.tokens.get(address)).id();}
    void denied(Runnable work,int code){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(code);}

    @Test void searchRechecksWorkspaceTerminationAfterExternalCandidateResponse(){
        Actor actor=account();long w=workspace.create(actor,"Search closure").id();candidates.afterSearch=()->workspace.terminate(actor,w,"Search closure",workspace.terminationPreview(actor,w).confirmation());
        try{denied(()->songs.search(actor,w,"candidate"),404);}finally{candidates.afterSearch=null;}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM song WHERE workspace_id=?",Integer.class,w)).isZero();
    }

    @Test void fullSetlistFlowPreservesPerUseSettingsAndStructuredForm(){
        Actor actor=account();long w=workspace.create(actor,"Worship").id();long d=documents.create(actor,w,"Sunday","RESTRICTED").id();long song=songs.register(actor,w,"Amazing Grace","Traditional").id();
        var first=setlists.add(actor,w,d,song,0);long item=first.items().getFirst().id();var second=setlists.add(actor,w,d,song,first.version());long other=second.items().getLast().id();
        var settings=setlists.settings(actor,w,d,item,"G",new BigDecimal("72.00"),List.of("Piano","Vocal"),second.version());
        var notes=setlists.notes(actor,w,d,item,"Start softly",settings.version());
        var block=new SetlistService.Block("stable-intro","Intro",1,"Piano","Start","quiet");
        var form=setlists.songForm(actor,w,d,item,List.of(block,new SetlistService.Block("stable-a","A",2,null,null,null)),notes.version());
        assertThat(form.items().getFirst().songForm().version()).isEqualTo(1);assertThat(form.items().getFirst().songForm().blocks()).containsExactly(block,new SetlistService.Block("stable-a","A",2,null,null,null));
        assertThat(form.items().getLast().key()).isNull();assertThat(form.items().getLast().songForm().blocks()).isEmpty();
        var reorder=setlists.reorder(actor,w,d,List.of(other,item),form.version());assertThat(reorder.items()).extracting(SetlistService.ItemView::id).containsExactly(other,item);assertThat(reorder.items()).extracting(SetlistService.ItemView::position).containsExactly(0,1);
        var removed=setlists.remove(actor,w,d,other,reorder.version());assertThat(removed.items().getFirst().position()).isZero();assertThat(removed.items().getFirst().notes()).isEqualTo("Start softly");
        var updated=setlists.update(actor,w,d,"Next Sunday","Service notes",removed.version());assertThat(updated.title()).isEqualTo("Next Sunday");assertThat(updated.notes()).isEqualTo("Service notes");assertThat(documents.get(actor,w,d).version()).isEqualTo(updated.version());
    }
    @Test void sameTitleNeverAutoMergesAndZeroCandidatesNeverCreatesSongs(){
        Actor actor=account();long w=workspace.create(actor,"Worship").id();long first=songs.register(actor,w,"Same Title",null).id(),second=songs.register(actor,w,"Same Title",null).id();assertThat(first).isNotEqualTo(second);
        assertThat(songs.search(actor,w,"No results")).isEmpty();assertThat(songs.list(actor,w)).hasSize(2);
    }
    @Test void editRolesAndTenantIdsAreCheckedAtCapabilityBoundary(){
        Actor owner=account(),editor=account(),viewer=account(),outsider=account();long w=workspace.create(owner,"Worship").id();long editorId=join(owner,w,editor),viewerId=join(owner,w,viewer);long d=documents.create(owner,w,"Open","OPEN").id();long song=songs.register(owner,w,"Song",null).id();
        denied(()->setlists.add(viewer,w,d,song,0),403);var document=documents.grant(owner,w,d,viewerId,"VIEWER",0);document=documents.grant(owner,w,d,editorId,"EDITOR",document.version());long expected=document.version();
        denied(()->setlists.add(viewer,w,d,song,expected),403);assertThat(setlists.add(editor,w,d,song,expected).items()).hasSize(1);denied(()->setlists.get(outsider,w,d),403);
        long foreignW=workspace.create(outsider,"Foreign").id(),foreignSong=songs.register(outsider,foreignW,"Foreign",null).id();long version=setlists.get(owner,w,d).version();denied(()->setlists.add(owner,w,d,foreignSong,version),404);
        long foreignD=documents.create(outsider,foreignW,"Foreign","OPEN").id();denied(()->setlists.get(owner,w,foreignD),404);assertThat(setlists.get(owner,w,d).version()).isEqualTo(version);
    }
    @Test void invalidOrderAndFormRollBackWithoutAdvancingVersion(){
        Actor actor=account();long w=workspace.create(actor,"Worship").id(),d=documents.create(actor,w,"Sunday","OPEN").id(),song=songs.register(actor,w,"Song",null).id();var first=setlists.add(actor,w,d,song,0);long item=first.items().getFirst().id();
        denied(()->setlists.reorder(actor,w,d,List.of(item,item),first.version()),400);denied(()->setlists.reorder(actor,w,d,List.of(999999L),first.version()),400);
        var block=new SetlistService.Block("same","A",1,null,null,null);denied(()->setlists.songForm(actor,w,d,item,List.of(block,block),first.version()),400);
        denied(()->setlists.songForm(actor,w,d,item,List.of(new SetlistService.Block("id","A",0,null,null,null)),first.version()),400);
        assertThat(setlists.get(actor,w,d)).isEqualTo(first);
    }
    @Test void concurrentStaleWritesHaveOneWinnerAndNeverLoseData()throws Exception{
        Actor actor=account();long w=workspace.create(actor,"Worship").id(),d=documents.create(actor,w,"Sunday","OPEN").id(),song=songs.register(actor,w,"Song",null).id();
        try(var executor=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);Callable<Boolean> work=()->{barrier.await();try{setlists.add(actor,w,d,song,0);return true;}catch(CapabilityException expected){assertThat(expected.code()).isEqualTo("VERSION_CONFLICT");return false;}};var first=executor.submit(work);var second=executor.submit(work);assertThat((first.get(20,TimeUnit.SECONDS)?1:0)+(second.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);}
        var current=setlists.get(actor,w,d);assertThat(current.version()).isEqualTo(1);assertThat(current.items()).hasSize(1);denied(()->setlists.notes(actor,w,d,current.items().getFirst().id(),"stale",0),409);assertThat(setlists.get(actor,w,d)).isEqualTo(current);
    }
}
