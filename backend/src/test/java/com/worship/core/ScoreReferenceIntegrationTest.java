package com.worship.core;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.*;
import com.worship.core.document.application.DocumentService;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.song.application.SongService;
import com.worship.core.score.application.ScoreService;
import com.worship.core.reference.application.ReferenceService;
import com.worship.core.integration.storage.*;
import com.worship.core.integration.youtube.VideoSearch;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest(properties="worship.scores.max-bytes=4096") @Testcontainers
@Import({ScoreReferenceIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class ScoreReferenceIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @TestConfiguration static class Fakes {
        @Bean @Primary FakeStorage storage(){return new FakeStorage();}
        @Bean @Primary FakeVideos videos(){return new FakeVideos();}
    }
    static class FakeVideos implements VideoSearch {
        volatile Runnable afterSearch;
        public List<Video> search(String query){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();var callback=afterSearch;afterSearch=null;if(callback!=null)callback.run();return List.of(new Video("abcdefghijk","Candidate","Channel"));}
    }
    @Autowired FakeVideos videos;
    @Test void searchRechecksMembershipRemovalAfterExternalVideoResponse(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Video search membership").id(),m=join(admin,w,member).id();
        videos.afterSearch=()->workspace.remove(admin,w,m);
        try{denied(()->references.search(member,w,"candidate"),403);}finally{videos.afterSearch=null;}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM song_reference WHERE workspace_id=?",Integer.class,w)).isZero();
    }
    static class FakeStorage implements ObjectStorage {
        final Map<String,byte[]> objects=new ConcurrentHashMap<>();volatile boolean failDelete,failPut;volatile Runnable afterRead;int puts;
        private void outside(){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();}
        public void put(String key,byte[] bytes,String media){outside();byte[] prior=objects.putIfAbsent(key,bytes.clone());if(prior!=null&&!Arrays.equals(prior,bytes))throw new IllegalStateException("Object keys are immutable");puts++;if(failPut){failPut=false;throw new IllegalStateException("simulated uncertain storage put");}}
        public byte[] get(String key){
            outside();
            byte[] bytes=objects.get(key).clone();
            Runnable callback=afterRead;
            afterRead=null;
            if(callback!=null)callback.run();
            return bytes;
        }
        public void delete(String key){outside();if(failDelete)throw new IllegalStateException("simulated cleanup failure");objects.remove(key);}
    }
    @Autowired DocumentService documents;@Autowired WorkspaceService workspace;@Autowired IdentityService identity;
    @Autowired SetlistService setlists;@Autowired SongService songs;@Autowired ScoreService scores;@Autowired ReferenceService references;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;@Autowired FakeStorage storage;@Autowired JdbcTemplate jdbc;
    @Test void terminationDuringScoreReadBlocksBytesAndPreservesStoredFile()throws Exception{
        Actor actor=account();long w=workspace.create(actor,"Score closure").id();var score=scores.upload(actor,w,null,"score.pdf","application/pdf",pdf());
        storage.afterRead=()->workspace.terminate(actor,w,"Score closure",workspace.terminationPreview(actor,w).confirmation());
        try{var failure=catchThrowable(()->scores.download(actor,w,score.id()));assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(404);}finally{storage.afterRead=null;}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM score WHERE workspace_id=?",Integer.class,w)).isEqualTo(1);assertThat(workspace.terminationStatus(actor,w).state()).isEqualTo("TERMINATED");
    }
    @Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    Actor account(){String address=UUID.randomUUID()+"@example.org";identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    void denied(Runnable work,int code){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(code);}
    byte[] pdf()throws Exception{try(var pdf=new PDDocument();var bytes=new ByteArrayOutputStream()){pdf.addPage(new PDPage());pdf.save(bytes);return bytes.toByteArray();}}
    private WorkspaceService.MemberView join(Actor admin,long workspaceId,Actor member){
        String target=identity.get(member).emails().getFirst().email();
        workspace.invite(admin,workspaceId,target,UUID.randomUUID().toString());
        return workspace.accept(member,invitations.tokens.get(target));
    }
    @Test void membershipRemovedDuringStorageReadCannotReceiveScoreBytes()throws Exception{
        Actor admin=account(),member=account();
        long w=workspace.create(admin,"Worship").id();
        var membership=join(admin,w,member);
        byte[] bytes=pdf();
        var score=scores.upload(admin,w,null,"score.pdf","application/pdf",bytes);
        storage.afterRead=()->workspace.remove(admin,w,membership.id());
        try{
            denied(()->scores.download(member,w,score.id()),403);
            assertThat(workspace.members(admin,w)).noneMatch(m->m.id()==membership.id());
            assertThat(scores.download(admin,w,score.id()).bytes()).isEqualTo(bytes);
        }finally{storage.afterRead=null;}
    }
    @Test void accountWithdrawnDuringStorageReadCannotReceiveScoreBytes()throws Exception{
        Actor admin=account(),member=account();
        long w=workspace.create(admin,"Worship").id();
        join(admin,w,member);
        byte[] bytes=pdf();
        var score=scores.upload(admin,w,null,"score.pdf","application/pdf",bytes);
        storage.afterRead=()->identity.withdraw(member);
        try{
            denied(()->scores.download(member,w,score.id()),401);
            assertThat(identity.valid(member)).isFalse();
            assertThat(scores.download(admin,w,score.id()).bytes()).isEqualTo(bytes);
        }finally{storage.afterRead=null;}
    }
    @Test void uploadedScoreCanBeReusedWithinWorkspaceButNeverAcrossTenants()throws Exception{
        Actor actor=account(),other=account();long w=workspace.create(actor,"Worship").id(),foreign=workspace.create(other,"Other").id(),song=songs.register(actor,w,"Song",null).id();byte[] file=pdf();var score=scores.upload(actor,w,song,"score.pdf","application/pdf",file);
        assertThat(scores.download(actor,w,score.id()).bytes()).isEqualTo(file);assertThat(scores.list(actor,w)).containsExactly(score);
        long d=documents.create(actor,w,"Sunday","OPEN").id();var list=setlists.add(actor,w,d,song,0);long item=list.items().getFirst().id();var selected=setlists.selectScore(actor,w,d,item,score.id(),list.version());assertThat(selected.items().getFirst().score()).isEqualTo(score);
        long otherScore=scores.upload(other,foreign,null,"foreign.pdf","application/pdf",file).id();denied(()->scores.download(actor,w,otherScore),404);denied(()->scores.download(other,w,score.id()),403);denied(()->setlists.selectScore(actor,w,d,item,otherScore,selected.version()),404);assertThat(setlists.get(actor,w,d).version()).isEqualTo(selected.version());
    }
    @Test void invalidFilesSizesAndMimeAreRejectedBeforeStorage()throws Exception{
        Actor actor=account();long w=workspace.create(actor,"Worship").id();int before=storage.puts;
        denied(()->scores.upload(actor,w,null,"bad.pdf","application/pdf","%PDF-broken".getBytes()),400);
        denied(()->scores.upload(actor,w,null,"large.pdf","application/pdf",new byte[4097]),400);
        denied(()->scores.upload(actor,w,null,"script.svg","image/svg+xml","<svg/>".getBytes()),400);
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",bytes);byte[] png=bytes.toByteArray();denied(()->scores.upload(actor,w,null,"image.jpg","image/jpeg",png),400);
        assertThat(storage.puts).isEqualTo(before);assertThat(scores.upload(actor,w,null,"image.png","image/png",png).mediaType()).isEqualTo("image/png");
    }
    @Test void uncertainStoragePutCompensatesWithoutSavingScore()throws Exception{
        Actor actor=account();long w=workspace.create(actor,"Worship").id();byte[] file=pdf();int initial=storage.objects.size();storage.failPut=true;
        assertThatThrownBy(()->scores.upload(actor,w,null,"score.pdf","application/pdf",file)).isInstanceOf(RuntimeException.class);assertThat(storage.objects).hasSize(initial);assertThat(scores.list(actor,w)).isEmpty();
    }
    @Test void dbFailureCompensatesAndFailedCompensationIsObservable()throws Exception{
        Actor actor=account();long w=workspace.create(actor,"Worship").id();byte[] file=pdf();int initial=storage.objects.size();
        jdbc.execute("ALTER TABLE score ADD CONSTRAINT reject_test_score CHECK(workspace_id<>"+w+" OR filename<>'score.pdf')");
        try{
            assertThatThrownBy(()->scores.upload(actor,w,null,"score.pdf","application/pdf",file)).isInstanceOf(RuntimeException.class);assertThat(storage.objects).hasSize(initial);
            storage.failDelete=true;try{assertThatThrownBy(()->scores.upload(actor,w,null,"score.pdf","application/pdf",file)).isInstanceOf(RuntimeException.class);}finally{storage.failDelete=false;}
            assertThat(storage.objects).hasSize(initial+1);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM storage_cleanup_failure WHERE workspace_id=?",Integer.class,w)).isEqualTo(1);assertThat(scores.list(actor,w)).isEmpty();
        }finally{jdbc.execute("ALTER TABLE score DROP CHECK reject_test_score");}
    }
    @Test void directAndYoutubeReferencesAreExplicitlyRegisteredAndSelected(){
        Actor actor=account(),other=account();long w=workspace.create(actor,"Worship").id(),foreign=workspace.create(other,"Other").id();
        assertThat(references.search(actor,w,"Song")).hasSize(1);assertThat(references.list(actor,w)).isEmpty();var direct=references.register(actor,w,"https://example.org/lesson","Lesson");var youtube=references.registerVideo(actor,w,"abcdefghijk","Video");assertThat(youtube.videoId()).isEqualTo("abcdefghijk");
        denied(()->references.register(actor,w,"javascript:alert(1)",null),400);denied(()->references.register(actor,w,"/relative",null),400);denied(()->references.register(actor,w,"https://user:password@example.org",null),400);
        long song=songs.register(actor,w,"Song",null).id(),d=documents.create(actor,w,"Sunday","OPEN").id();var list=setlists.add(actor,w,d,song,0);long item=list.items().getFirst().id();var selected=setlists.selectReference(actor,w,d,item,youtube.id(),list.version());assertThat(selected.items().getFirst().reference()).isEqualTo(youtube);var updated=setlists.selectReference(actor,w,d,item,direct.id(),selected.version());assertThat(updated.items().getFirst().reference()).isEqualTo(direct);
        long foreignReference=references.register(other,foreign,"https://example.org/foreign",null).id();denied(()->setlists.selectReference(actor,w,d,item,foreignReference,updated.version()),404);
    }
    @Test void localStorageKeysCannotEscapeRootAndObjectsAreNotSilentlyOverwritten(@TempDir java.nio.file.Path temp){
        var local=new LocalObjectStorage(temp);local.put("../../elsewhere",new byte[]{1,2,3},"application/octet-stream");assertThat(local.get("../../elsewhere")).containsExactly(1,2,3);assertThatThrownBy(()->local.put("../../elsewhere",new byte[]{4},"application/octet-stream")).isInstanceOf(CapabilityException.class);local.delete("../../elsewhere");
    }
}
