package com.worship.core;

import java.net.URI;
import java.util.*;
import java.util.concurrent.*;
import com.worship.core.document.application.DocumentService;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.song.application.SongService;
import com.worship.core.reference.application.ReferenceService;
import com.worship.core.integration.youtube.*;
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

@SpringBootTest(properties="worship.credentials.key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") @Testcontainers
@Import({YouTubeIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class YouTubeIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @TestConfiguration static class Fakes {@Bean @Primary FakeYouTube youtube(){return new FakeYouTube();}}
    static class FakeYouTube implements YouTubeProvider {
        final Map<String,String> markers=new ConcurrentHashMap<>();final Map<String,List<String>> videos=new ConcurrentHashMap<>();
        volatile boolean uncertainCreate,failSync,failRevoke,safeCreateFailure,failFind;int creates,revokes,syncs;
        volatile CountDownLatch entered,release,exchangeEntered,exchangeRelease;volatile Runnable afterSync;
        private void outside(){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();}
        public String authorizationUrl(String state,String challenge){outside();assertThat(challenge).hasSize(43);return "https://fake.example/authorize?state="+state;}
        public String exchange(String code,String verifier){outside();assertThat(verifier).hasSize(43);if(exchangeEntered!=null){exchangeEntered.countDown();try{if(!exchangeRelease.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Timed out");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}}return "refresh-"+code;}
        public String accessToken(String refresh){outside();assertThat(refresh).startsWith("refresh-");return "fake-access";}
        public void revoke(String refresh){outside();revokes++;if(failRevoke)throw new ProviderFailure(false);}
        public Optional<String> findPlaylist(String access,String marker){outside();if(failFind){failFind=false;throw new ProviderFailure(false);}return Optional.ofNullable(markers.get(marker));}
        public String createPlaylist(String access,String title,String marker){outside();if(safeCreateFailure){safeCreateFailure=false;throw new ProviderFailure(false);}creates++;String id="PL"+UUID.randomUUID().toString().replace("-","");markers.put(marker,id);if(entered!=null){entered.countDown();try{if(!release.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Timed out");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}}if(uncertainCreate){uncertainCreate=false;throw new ProviderFailure(true);}return id;}
        public void synchronize(String access,String id,List<String> expected){outside();syncs++;if(failSync){failSync=false;videos.put(id,expected.stream().limit(1).toList());throw new ProviderFailure(true);}videos.put(id,List.copyOf(expected));var callback=afterSync;afterSync=null;if(callback!=null)callback.run();}
    }
    @Autowired DocumentService documents;@Autowired WorkspaceService workspace;@Autowired IdentityService identity;
    @Autowired SetlistService setlists;@Autowired SongService songs;@Autowired ReferenceService references;
    @Autowired YouTubeAuthorizationService authorization;@Autowired PlaylistService playlists;@Autowired FakeYouTube provider;@Autowired CredentialCipher cipher;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;@Autowired JdbcTemplate jdbc;
    Actor account(){String address=UUID.randomUUID()+"@example.org";identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    void denied(Runnable work,int code){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(code);}
    String state(String url){return URI.create(url).getRawQuery().substring("state=".length());}
    void connect(Actor actor){String state=state(authorization.start(actor));authorization.complete(actor,state,UUID.randomUUID().toString());}
    record Source(Actor actor,long workspace,long document,long version) {}
    Source source(boolean connected){Actor actor=account();long w=workspace.create(actor,"Worship").id(),d=documents.create(actor,w,"Sunday","RESTRICTED").id(),song=songs.register(actor,w,"Song",null).id();var list=setlists.add(actor,w,d,song,0);var reference=references.registerVideo(actor,w,"abcdefghijk","Video");list=setlists.selectReference(actor,w,d,list.items().getFirst().id(),reference.id(),list.version());if(connected)connect(actor);return new Source(actor,w,d,list.version());}
    PlaylistService.Result run(Source s,String key){return playlists.synchronize(s.actor(),s.workspace(),s.document(),null,s.version(),key);}

    @Test void oauthStateIsBoundSingleUseAndEncryptedAndDoesNotLinkGoogle(){
        Actor actor=account(),other=account();String state=state(authorization.start(actor));denied(()->authorization.complete(other,state,"wrong-user"),400);
        authorization.complete(actor,state,"secret-code");assertThat(authorization.connected(actor)).isTrue();assertThat(identity.get(actor).googleIdentityIds()).isEmpty();denied(()->authorization.complete(actor,state,"replay"),400);
        String encrypted=jdbc.queryForObject("SELECT encrypted_refresh FROM youtube_authorization WHERE user_id=?",String.class,actor.userId());assertThat(encrypted).startsWith("v1:").doesNotContain("refresh-secret-code");
        assertThat(cipher.decrypt(encrypted,"youtube-refresh:"+actor.userId())).isEqualTo("refresh-secret-code");assertThatThrownBy(()->cipher.decrypt(encrypted,"youtube-refresh:"+other.userId())).isInstanceOf(IllegalStateException.class);
        String another=cipher.encrypt("refresh-secret-code","youtube-refresh:"+actor.userId());assertThat(another).isNotEqualTo(encrypted);
    }
    @Test void terminationAfterProviderSyncCannotCommitSuccessOrUndoExternalResult(){
        var s=source(true);int syncs=provider.syncs;provider.afterSync=()->{
            var preview=workspace.terminationPreview(s.actor(),s.workspace());assertThat(preview.ongoingWork()).isTrue();workspace.terminate(s.actor(),s.workspace(),"Worship",preview.confirmation());
        };
        try{denied(()->run(s,"closed-after-sync"),404);}finally{provider.afterSync=null;}
        assertThat(jdbc.queryForObject("SELECT status FROM playlist_command WHERE workspace_id=? AND command_key='closed-after-sync'",String.class,s.workspace())).isEqualTo("FAILED_RETRYABLE");
        String playlist=jdbc.queryForObject("SELECT playlist_id FROM playlist_command WHERE workspace_id=? AND command_key='closed-after-sync'",String.class,s.workspace());assertThat(provider.videos.get(playlist)).containsExactly("abcdefghijk");assertThat(provider.syncs).isEqualTo(syncs+1);assertThat(authorization.connected(s.actor())).isTrue();denied(()->run(s,"closed-after-sync"),404);
    }
    @Test void expiredIntentAndDisconnectedPendingIntentAreRejected(){
        Actor actor=account();String expired=state(authorization.start(actor));jdbc.update("UPDATE youtube_oauth_intent SET expires_at='2000-01-01' WHERE state_hash=?",IdentityService.hash(expired));denied(()->authorization.complete(actor,expired,"expired"),400);
        String pending=state(authorization.start(actor));authorization.disconnect(actor);denied(()->authorization.complete(actor,pending,"cancelled"),400);
    }
    @Test void youtubeAuthorizationIsRequiredEvenWhenGoogleIdentityExists(){
        var source=source(false);identity.googleLink(source.actor(),"https://accounts.google.com",UUID.randomUUID().toString());denied(()->run(source,"no-auth"),403);
        connect(source.actor());assertThat(run(source,"connected").status()).isEqualTo("SUCCEEDED");authorization.disconnect(source.actor());denied(()->run(source,"after-disconnect"),403);
    }
    @Test void uncertainCreateIsReconciledWithoutCreatingAnotherPlaylist(){
        var source=source(true);int before=provider.creates;provider.uncertainCreate=true;var first=run(source,"uncertain");assertThat(first.status()).isEqualTo("UNCERTAIN");var retried=run(source,"uncertain");assertThat(retried.status()).isEqualTo("SUCCEEDED");assertThat(provider.creates).isEqualTo(before+1);assertThat(provider.videos.get(retried.playlistId())).containsExactly("abcdefghijk");
        assertThat(run(source,"uncertain")).isEqualTo(retried);assertThat(provider.creates).isEqualTo(before+1);
    }
    @Test void failedReconciliationCannotTurnUnknownCreationIntoBlindRetry(){
        var source=source(true);int before=provider.creates;provider.uncertainCreate=true;assertThat(run(source,"reconcile-error").status()).isEqualTo("UNCERTAIN");
        provider.failFind=true;assertThat(run(source,"reconcile-error").status()).isEqualTo("UNCERTAIN");assertThat(provider.creates).isEqualTo(before+1);
        assertThat(run(source,"reconcile-error").status()).isEqualTo("SUCCEEDED");assertThat(provider.creates).isEqualTo(before+1);
        provider.uncertainCreate=true;assertThat(run(source,"missing-marker").status()).isEqualTo("UNCERTAIN");provider.markers.clear();
        assertThat(run(source,"missing-marker").status()).isEqualTo("UNCERTAIN");assertThat(run(source,"missing-marker").status()).isEqualTo("UNCERTAIN");assertThat(provider.creates).isEqualTo(before+2);
    }
    @Test void partialFailureDoesNotChangeInternalSetlistAndRetryUsesSamePlaylist(){
        var source=source(true);var before=setlists.get(source.actor(),source.workspace(),source.document());int creates=provider.creates;provider.failSync=true;var failed=run(source,"partial");assertThat(failed.status()).isEqualTo("FAILED_RETRYABLE");assertThat(failed.playlistId()).isNotBlank();assertThat(setlists.get(source.actor(),source.workspace(),source.document())).isEqualTo(before);
        var retried=run(source,"partial");assertThat(retried.status()).isEqualTo("SUCCEEDED");assertThat(retried.playlistId()).isEqualTo(failed.playlistId());assertThat(provider.creates).isEqualTo(creates+1);
        var updated=setlists.notes(source.actor(),source.workspace(),source.document(),before.items().getFirst().id(),"Latest",before.version());provider.failSync=true;var command=playlists.synchronize(source.actor(),source.workspace(),source.document(),retried.playlistId(),updated.version(),"update");assertThat(command.status()).isEqualTo("FAILED_RETRYABLE");var newer=setlists.update(source.actor(),source.workspace(),source.document(),"Latest","Notes",updated.version());denied(()->playlists.synchronize(source.actor(),source.workspace(),source.document(),retried.playlistId(),updated.version(),"update"),409);assertThat(newer.version()).isGreaterThan(updated.version());
    }
    @Test void reconnectCannotReplayCommandFromPreviousAuthorizationGeneration(){
        var source=source(true);provider.failSync=true;assertThat(run(source,"generation-bound").status()).isEqualTo("FAILED_RETRYABLE");authorization.disconnect(source.actor());connect(source.actor());denied(()->run(source,"generation-bound"),409);
    }
    @Test void concurrentSameCommandRunsOneCreate()throws Exception{
        var source=source(true);provider.entered=new CountDownLatch(1);provider.release=new CountDownLatch(1);int before=provider.creates;
        try(var executor=Executors.newSingleThreadExecutor()){var first=executor.submit(()->run(source,"concurrent"));assertThat(provider.entered.await(20,TimeUnit.SECONDS)).isTrue();assertThat(run(source,"concurrent").status()).isEqualTo("RUNNING");provider.release.countDown();assertThat(first.get(20,TimeUnit.SECONDS).status()).isEqualTo("SUCCEEDED");}
        finally{provider.release.countDown();provider.entered=null;provider.release=null;}
        assertThat(provider.creates).isEqualTo(before+1);
    }
    @Test void staleCreateWorkerCannotSyncOrOverwriteReconciledWinner()throws Exception{
        var source=source(true);provider.entered=new CountDownLatch(1);provider.release=new CountDownLatch(1);int creates=provider.creates,syncs=provider.syncs;
        try(var pool=Executors.newSingleThreadExecutor()){
            var first=pool.submit(()->run(source,"fenced"));assertThat(provider.entered.await(20,TimeUnit.SECONDS)).isTrue();jdbc.update("UPDATE playlist_command SET started_at='2000-01-01' WHERE workspace_id=? AND command_key='fenced'",source.workspace());
            var winner=run(source,"fenced");assertThat(winner.status()).isEqualTo("SUCCEEDED");provider.release.countDown();assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(winner);assertThat(provider.creates).isEqualTo(creates+1);assertThat(provider.syncs).isEqualTo(syncs+1);
        }finally{provider.release.countDown();provider.entered=null;provider.release=null;}
    }
    @Test void disconnectPersistsEvenWhenProviderRevokeOrDecryptionFails(){
        Actor actor=account();connect(actor);provider.failRevoke=true;try{assertThat(authorization.disconnect(actor).revokeStatus()).isEqualTo("PROVIDER_REVOKE_FAILED");}finally{provider.failRevoke=false;}assertThat(authorization.connected(actor)).isFalse();
        connect(actor);jdbc.update("UPDATE youtube_authorization SET encrypted_refresh='corrupt' WHERE user_id=?",actor.userId());assertThat(authorization.disconnect(actor).connected()).isFalse();assertThat(authorization.connected(actor)).isFalse();
    }
    @Test void disconnectWhileCodeExchangeIsRunningCannotRestoreLocalCredential()throws Exception{
        Actor actor=account();String state=state(authorization.start(actor));provider.exchangeEntered=new CountDownLatch(1);provider.exchangeRelease=new CountDownLatch(1);int revokes=provider.revokes;
        try(var pool=Executors.newSingleThreadExecutor()){
            var callback=pool.submit(()->authorization.complete(actor,state,"cancel-race"));assertThat(provider.exchangeEntered.await(20,TimeUnit.SECONDS)).isTrue();authorization.disconnect(actor);provider.exchangeRelease.countDown();
            assertThatThrownBy(()->callback.get(20,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class).hasCauseInstanceOf(CapabilityException.class);assertThat(authorization.connected(actor)).isFalse();assertThat(provider.revokes).isEqualTo(revokes+1);
        }finally{provider.exchangeRelease.countDown();provider.exchangeEntered=null;provider.exchangeRelease=null;}
    }
    @Test void withdrawalDiscardsAuthorizationWithoutProviderCallsInsideTransaction(){
        Actor actor=account();connect(actor);int before=provider.revokes;identity.withdraw(actor);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM youtube_authorization WHERE user_id=?",Integer.class,actor.userId())).isZero();assertThat(provider.revokes).isEqualTo(before);
    }
}
