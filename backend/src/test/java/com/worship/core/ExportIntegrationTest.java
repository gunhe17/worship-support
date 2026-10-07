package com.worship.core;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.nio.file.*;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.cos.*;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.rendering.PDFRenderer;
import javax.imageio.ImageIO;
import com.worship.core.document.application.DocumentService;
import com.worship.core.export.application.*;
import com.worship.core.export.infrastructure.PdfBoxExportRenderer;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.song.application.SongService;
import com.worship.core.reference.application.ReferenceService;
import com.worship.core.score.application.ScoreService;
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
@Import({ExportIntegrationTest.Fakes.class,ScoreReferenceIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class ExportIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @TestConfiguration static class Fakes {@Bean @Primary FakeRenderer renderer(){return new FakeRenderer();}}
    static class FakeRenderer implements ExportRenderer {
        final java.util.concurrent.atomic.AtomicInteger calls=new java.util.concurrent.atomic.AtomicInteger();
        volatile boolean fail;volatile CountDownLatch entered,release;
        public byte[] pdf(SetlistService.SetlistView source){
            return pdf(source,Map.of());
        }
        public byte[] pdf(SetlistService.SetlistView source,Map<Long,ScoreContent> scores){
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            calls.incrementAndGet();
            if(fail){fail=false;throw new IllegalStateException("Simulated renderer failure");}
            if(entered!=null){entered.countDown();try{if(!release.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Timed out");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}}
            return new PdfBoxExportRenderer().pdf(source,scores);
        }
    }
    @Autowired DocumentService documents;@Autowired WorkspaceService workspace;@Autowired IdentityService identity;
    @Autowired SetlistService setlists;@Autowired SongService songs;@Autowired ReferenceService references;@Autowired ExportService exports;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;@Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    @Autowired ScoreReferenceIntegrationTest.FakeStorage storage;@Autowired FakeRenderer renderer;@Autowired JdbcTemplate jdbc;
    @Autowired ScoreService scores;
    Actor account(){String address=UUID.randomUUID()+"@example.org";identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    long join(Actor admin,long w,Actor member){String address=identity.get(member).emails().getFirst().email();workspace.invite(admin,w,address,UUID.randomUUID().toString());return workspace.accept(member,invitations.tokens.get(address)).id();}
    void denied(Runnable work,int code){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(code);}
    record Source(Actor actor,long workspace,long document,long version) {}
    Source source(){Actor actor=account();long w=workspace.create(actor,"찬양팀").id(),d=documents.create(actor,w,"주일 예배 콘티","RESTRICTED").id(),song=songs.register(actor,w,"주님의 은혜","찬양팀").id();var list=setlists.add(actor,w,d,song,0);long item=list.items().getFirst().id();list=setlists.settings(actor,w,d,item,"D",new BigDecimal("72.50"),List.of("보컬","피아노"),list.version());list=setlists.notes(actor,w,d,item,"조용하게 시작",list.version());list=setlists.songForm(actor,w,d,item,List.of(new SetlistService.Block("verse-1","Verse",2,"피아노만","함께 찬양","점점 크게")),list.version());var ref=references.registerVideo(actor,w,"abcdefghijk","연습 영상");list=setlists.selectReference(actor,w,d,item,ref.id(),list.version());list=setlists.update(actor,w,d,"주일 예배 콘티","예배 시작 전 기도",list.version());return new Source(actor,w,d,list.version());}
    ExportService.ExportView generate(Source s,String key){return exports.generate(s.actor(),s.workspace(),s.document(),s.version(),key);}
    byte[] download(Source s,long id){return exports.download(s.actor(),s.workspace(),s.document(),id).bytes();}
    String text(byte[] bytes)throws Exception{try(var pdf=Loader.loadPDF(bytes)){return new PDFTextStripper().getText(pdf);}}

    byte[] twoPageScore()throws Exception{
        try(var pdf=new PDDocument();var out=new ByteArrayOutputStream()){
            for(int pageNumber=1;pageNumber<=2;pageNumber++){
                var page=new PDPage(PDRectangle.A4);
                if(pageNumber==2)page.setRotation(90);
                pdf.addPage(page);
                try(var content=new PDPageContentStream(pdf,page)){
                    // Keep text upright in the viewer on the /Rotate=90 source page.
                    if(pageNumber==2)content.transform(new org.apache.pdfbox.util.Matrix(0,1,-1,0,500,80));
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),24);
                    content.newLineAtOffset(80,400);
                    content.showText("ACTUAL_SCORE_PAGE_"+pageNumber);
                    content.endText();
                }
                var action=new PDActionJavaScript("app.alert('not part of printed score');");
                var link=new PDAnnotationLink();
                link.setRectangle(new PDRectangle(10,10,20,20));
                link.setAction(action);
                page.setAnnotations(List.of(link));
                var actions=new COSDictionary();
                actions.setItem(COSName.O,action.getCOSObject());
                page.getCOSObject().setItem(COSName.AA,actions);
            }
            pdf.getPages().getCOSObject().setItem(COSName.RESOURCES,pdf.getPage(0).getResources().getCOSObject());
            for(var page:pdf.getPages())page.setResources(null);
            pdf.save(out);
            return out.toByteArray();
        }
    }
    byte[] colorImage(String format,int color)throws Exception{
        var image=new BufferedImage(12,8,BufferedImage.TYPE_INT_RGB);
        for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();x++)image.setRGB(x,y,color);
        var out=new ByteArrayOutputStream();
        assertThat(ImageIO.write(image,format,out)).isTrue();
        return out.toByteArray();
    }
    @Test void finalPdfContainsAllScorePagesAndRealPngJpegContentInSetlistOrder()throws Exception{
        var s=source();
        var list=setlists.get(s.actor(),s.workspace(),s.document());
        var pdfScore=scores.upload(s.actor(),s.workspace(),null,"two-pages.pdf","application/pdf",twoPageScore());
        list=setlists.selectScore(s.actor(),s.workspace(),s.document(),list.items().getFirst().id(),pdfScore.id(),list.version());
        for(var image:List.of(new Object[]{"png",0xff0000},new Object[]{"jpeg",0x0000ff})){
            String format=(String)image[0];
            long song=songs.register(s.actor(),s.workspace(),format+" score song",null).id();
            list=setlists.add(s.actor(),s.workspace(),s.document(),song,list.version());
            var score=scores.upload(s.actor(),s.workspace(),null,format+".image","image/"+format,colorImage(format,(Integer)image[1]));
            list=setlists.selectScore(s.actor(),s.workspace(),s.document(),list.items().getLast().id(),score.id(),list.version());
        }
        var export=exports.generate(s.actor(),s.workspace(),s.document(),list.version(),"real-score-pages");
        assertThat(export.status()).isEqualTo("SUCCEEDED");
        byte[] bytes=download(s,export.id());
        var evidence=Path.of("build/reports/export-score");
        Files.createDirectories(evidence);
        Files.write(evidence.resolve("mixed-score-setlist.pdf"),bytes);
        String content=text(bytes);
        assertThat(content).contains("ACTUAL_SCORE_PAGE_1","ACTUAL_SCORE_PAGE_2","함께 찬양");
        assertThat(content.indexOf("ACTUAL_SCORE_PAGE_1")).isLessThan(content.indexOf("ACTUAL_SCORE_PAGE_2"));
        try(var pdf=Loader.loadPDF(bytes)){
            int redPages=0,bluePages=0,rotatedScorePages=0;
            var raster=new PDFRenderer(pdf);
            var preview=new BufferedImage(900,((pdf.getNumberOfPages()+2)/3)*440,BufferedImage.TYPE_INT_RGB);
            var graphics=preview.createGraphics();
            graphics.setColor(java.awt.Color.LIGHT_GRAY);
            graphics.fillRect(0,0,preview.getWidth(),preview.getHeight());
            for(int index=0;index<pdf.getNumberOfPages();index++){
                assertThat(pdf.getPage(index).getCOSObject().containsKey(COSName.AA)).isFalse();
                for(var annotation:pdf.getPage(index).getAnnotations()){
                    assertThat(annotation.getCOSObject().containsKey(COSName.A)).isFalse();
                    assertThat(annotation.getCOSObject().containsKey(COSName.AA)).isFalse();
                }
                var image=raster.renderImageWithDPI(index,36);
                double scale=Math.min(280.0/image.getWidth(),410.0/image.getHeight());
                graphics.drawImage(image,(index%3)*300+10,(index/3)*440+20,(int)(image.getWidth()*scale),(int)(image.getHeight()*scale),null);
                int pixel=image.getRGB(image.getWidth()/2,image.getHeight()/2);
                int red=(pixel>>16)&255,green=(pixel>>8)&255,blue=pixel&255;
                if(red>200&&green<60&&blue<60)redPages++;
                if(blue>200&&red<60&&green<60)bluePages++;
                if(pdf.getPage(index).getRotation()==90)rotatedScorePages++;
            }
            graphics.dispose();
            assertThat(ImageIO.write(preview,"png",evidence.resolve("preview.png").toFile())).isTrue();
            assertThat(redPages).isEqualTo(1);
            assertThat(bluePages).isEqualTo(1);
            assertThat(rotatedScorePages).isEqualTo(1);
        }
    }
    @Test void missingScoreFailsWithoutArtifactAndRetryKeepsOldSelectionAfterSourceChanges()throws Exception{
        var s=source();
        var list=setlists.get(s.actor(),s.workspace(),s.document());
        long item=list.items().getFirst().id();
        var original=scores.upload(s.actor(),s.workspace(),null,"original.pdf","application/pdf",twoPageScore());
        list=setlists.selectScore(s.actor(),s.workspace(),s.document(),item,original.id(),list.version());
        long originalVersion=list.version();
        String key=jdbc.queryForObject("SELECT object_key FROM score WHERE id=?",String.class,original.id());
        byte[] originalBytes=storage.objects.remove(key);
        var failed=exports.generate(s.actor(),s.workspace(),s.document(),originalVersion,"score-retry");
        assertThat(failed.status()).isEqualTo("FAILED_RETRYABLE");
        assertThat(failed.artifactHash()).isNull();
        var replacement=scores.upload(s.actor(),s.workspace(),null,"replacement.png","image/png",colorImage("png",0xff0000));
        setlists.selectScore(s.actor(),s.workspace(),s.document(),item,replacement.id(),list.version());
        storage.put(key,originalBytes,"application/pdf");
        var retry=exports.generate(s.actor(),s.workspace(),s.document(),originalVersion,"score-retry");
        assertThat(retry.status()).isEqualTo("SUCCEEDED");
        assertThat(retry.snapshotHash()).isEqualTo(failed.snapshotHash());
        assertThat(text(download(s,retry.id()))).contains("ACTUAL_SCORE_PAGE_1","ACTUAL_SCORE_PAGE_2","original.pdf").doesNotContain("replacement.png");
    }
    @Test void rendererRejectsMissingScoreAndConfiguredPageOutputLimits()throws Exception{
        var s=source();
        var source=setlists.get(s.actor(),s.workspace(),s.document());
        assertThatThrownBy(()->new PdfBoxExportRenderer(1,104857600).pdf(source)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->new PdfBoxExportRenderer(500,32).pdf(source)).isInstanceOf(IllegalStateException.class);
        var score=scores.upload(s.actor(),s.workspace(),null,"score.pdf","application/pdf",twoPageScore());
        var selected=setlists.selectScore(s.actor(),s.workspace(),s.document(),source.items().getFirst().id(),score.id(),source.version());
        assertThatThrownBy(()->new PdfBoxExportRenderer().pdf(selected,Map.of())).isInstanceOf(IllegalStateException.class);
        var renderer=new PdfBoxExportRenderer();
        assertThatThrownBy(()->renderer.pdf(selected,Map.of(score.id(),new ExportRenderer.ScoreContent("application/pdf",new byte[]{1,2,3}))))
            .isInstanceOf(IllegalStateException.class);
        byte[] encrypted;
        try(var pdf=Loader.loadPDF(twoPageScore());var output=new ByteArrayOutputStream()){
            var protection=new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy("owner-secret","reader-secret",new org.apache.pdfbox.pdmodel.encryption.AccessPermission());
            protection.setEncryptionKeyLength(128);pdf.protect(protection);pdf.save(output);encrypted=output.toByteArray();
        }
        byte[] protectedBytes=encrypted;
        assertThatThrownBy(()->renderer.pdf(selected,Map.of(score.id(),new ExportRenderer.ScoreContent("application/pdf",protectedBytes))))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test void exactVersionSnapshotAndPdfStayImmutableAfterOriginalChanges()throws Exception{
        var s=source();denied(()->exports.generate(s.actor(),s.workspace(),s.document(),s.version()-1,"stale"),409);
        var created=generate(s,"immutable");assertThat(created.status()).isEqualTo("SUCCEEDED");byte[] before=download(s,created.id());String canonical=jdbc.queryForObject("SELECT canonical_json FROM immutable_export WHERE id=?",String.class,created.id());
        assertThat(text(before)).contains("주일 예배 콘티","주님의 은혜","72.50","피아노","조용하게 시작","함께 찬양","abcdefghijk");
        setlists.update(s.actor(),s.workspace(),s.document(),"수정된 콘티","수정된 메모",s.version());
        assertThat(generate(s,"immutable")).isEqualTo(created);assertThat(download(s,created.id())).isEqualTo(before);assertThat(jdbc.queryForObject("SELECT canonical_json FROM immutable_export WHERE id=?",String.class,created.id())).isEqualTo(canonical);assertThat(created.snapshotHash()).isEqualTo(IdentityService.hash(canonical));
        denied(()->exports.generate(s.actor(),s.workspace(),s.document(),s.version()+1,"immutable"),409);
    }
    @Test void terminationWhileRenderingBlocksLateCommitAndCompensatesArtifact()throws Exception{
        var s=source();int initial=storage.objects.size();var previewBefore=workspace.terminationPreview(s.actor(),s.workspace());renderer.entered=new CountDownLatch(1);renderer.release=new CountDownLatch(1);
        try(var pool=Executors.newSingleThreadExecutor()){
            var task=pool.submit(()->generate(s,"closed-during-render"));assertThat(renderer.entered.await(20,TimeUnit.SECONDS)).isTrue();
            var preview=workspace.terminationPreview(s.actor(),s.workspace());assertThat(preview.ongoingWork()).isTrue();assertThat(preview.documentCount()).isEqualTo(1);
            denied(()->workspace.terminate(s.actor(),s.workspace(),"찬양팀",previewBefore.confirmation()),409);
            workspace.terminate(s.actor(),s.workspace(),"찬양팀",preview.confirmation());renderer.release.countDown();
            assertThatThrownBy(()->task.get(20,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class).satisfies(failure->assertThat(((CapabilityException)failure.getCause()).status()).isEqualTo(404));
            assertThat(jdbc.queryForObject("SELECT status FROM immutable_export WHERE workspace_id=? AND command_key='closed-during-render'",String.class,s.workspace())).isEqualTo("FAILED_RETRYABLE");
            assertThat(jdbc.queryForObject("SELECT object_key FROM immutable_export WHERE workspace_id=? AND command_key='closed-during-render'",String.class,s.workspace())).isNull();assertThat(storage.objects).hasSize(initial);denied(()->generate(s,"closed-during-render"),404);
        }finally{renderer.release.countDown();renderer.entered=null;renderer.release=null;}
    }
    @Test void downloadUsesCurrentPermissionAndTenantNotPossessionOfId(){
        var s=source();Actor viewer=account(),admin=account(),outsider=account();long viewerId=join(s.actor(),s.workspace(),viewer),adminId=join(s.actor(),s.workspace(),admin);workspace.transferAdmin(s.actor(),s.workspace(),adminId);
        var granted=documents.grant(s.actor(),s.workspace(),s.document(),viewerId,"VIEWER",s.version());var export=exports.generate(s.actor(),s.workspace(),s.document(),granted.version(),"viewer-readable");assertThat(export.status()).isEqualTo("SUCCEEDED");
        assertThat(exports.download(viewer,s.workspace(),s.document(),export.id()).bytes()).isNotEmpty();
        denied(()->exports.download(admin,s.workspace(),s.document(),export.id()),403);denied(()->exports.download(outsider,s.workspace(),s.document(),export.id()),403);
        long foreign=workspace.create(outsider,"Other").id(),d=documents.create(outsider,foreign,"Other","OPEN").id();denied(()->exports.download(outsider,foreign,d,export.id()),404);
        documents.revoke(s.actor(),s.workspace(),s.document(),viewerId,granted.version());denied(()->exports.download(viewer,s.workspace(),s.document(),export.id()),403);assertThat(workspace.list(outsider)).hasSize(1);
    }
    @Test void rendererFailureRetriesOriginalSnapshotEvenAfterSourceChanges()throws Exception{
        var s=source();renderer.fail=true;var failed=generate(s,"render-retry");assertThat(failed.status()).isEqualTo("FAILED_RETRYABLE");denied(()->download(s,failed.id()),409);
        setlists.update(s.actor(),s.workspace(),s.document(),"New source","Different",s.version());var retry=generate(s,"render-retry");assertThat(retry.id()).isEqualTo(failed.id());assertThat(retry.snapshotHash()).isEqualTo(failed.snapshotHash());assertThat(text(download(s,retry.id()))).contains("주일 예배 콘티").doesNotContain("New source");
    }
    @Test void failedArtifactCommitCompensatesAndFailedCleanupIsRecorded(){
        var s=source();int before=storage.objects.size();jdbc.execute("ALTER TABLE immutable_export ADD CONSTRAINT reject_test_export CHECK(workspace_id<>"+s.workspace()+" OR status<>'SUCCEEDED')");
        try{assertThat(generate(s,"db-fail").status()).isEqualTo("FAILED_RETRYABLE");assertThat(storage.objects).hasSize(before);storage.failDelete=true;try{assertThat(generate(s,"cleanup-fail").status()).isEqualTo("FAILED_RETRYABLE");}finally{storage.failDelete=false;}assertThat(storage.objects).hasSize(before+1);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM storage_cleanup_failure WHERE workspace_id=?",Integer.class,s.workspace())).isEqualTo(1);}
        finally{jdbc.execute("ALTER TABLE immutable_export DROP CHECK reject_test_export");}
        assertThat(generate(s,"db-fail").status()).isEqualTo("SUCCEEDED");
    }
    @Test void ambiguousStorageWriteIsCompensatedAndRetryPreservesSnapshot(){
        var s=source();int initial=storage.objects.size();storage.failPut=true;var failed=generate(s,"put-retry");assertThat(failed.status()).isEqualTo("FAILED_RETRYABLE");assertThat(storage.objects).hasSize(initial);
        var retry=generate(s,"put-retry");assertThat(retry.status()).isEqualTo("SUCCEEDED");assertThat(retry.id()).isEqualTo(failed.id());assertThat(retry.snapshotHash()).isEqualTo(failed.snapshotHash());
    }
    @Test void duplicateConcurrentExportHasOneImmutableArtifactAndCorruptionIsRejected()throws Exception{
        var s=source();renderer.entered=new CountDownLatch(1);renderer.release=new CountDownLatch(1);int before=storage.puts;long id;
        try(var pool=Executors.newSingleThreadExecutor()){var first=pool.submit(()->generate(s,"concurrent"));assertThat(renderer.entered.await(20,TimeUnit.SECONDS)).isTrue();assertThat(generate(s,"concurrent").status()).isEqualTo("RUNNING");renderer.release.countDown();var completed=first.get(20,TimeUnit.SECONDS);assertThat(completed.status()).isEqualTo("SUCCEEDED");id=completed.id();}
        finally{renderer.release.countDown();renderer.entered=null;renderer.release=null;}
        assertThat(storage.puts).isEqualTo(before+1);String key=jdbc.queryForObject("SELECT object_key FROM immutable_export WHERE id=?",String.class,id);storage.objects.put(key,new byte[]{1,2,3});denied(()->download(s,id),503);
    }
    @Test void staleWorkerIsFencedAndCannotReplaceCompletedArtifact()throws Exception{
        var s=source();int initial=storage.objects.size();renderer.entered=new CountDownLatch(1);renderer.release=new CountDownLatch(1);
        try(var pool=Executors.newSingleThreadExecutor()){
            var first=pool.submit(()->generate(s,"fenced"));assertThat(renderer.entered.await(20,TimeUnit.SECONDS)).isTrue();
            jdbc.update("UPDATE immutable_export SET started_at='2000-01-01' WHERE workspace_id=? AND command_key='fenced'",s.workspace());renderer.entered=null;
            var winner=generate(s,"fenced");assertThat(winner.status()).isEqualTo("SUCCEEDED");byte[] artifact=download(s,winner.id());renderer.release.countDown();
            assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(winner);assertThat(download(s,winner.id())).isEqualTo(artifact);assertThat(storage.objects).hasSize(initial+1);
        }finally{renderer.release.countDown();renderer.entered=null;renderer.release=null;}
    }
    @Test void permissionRevokedDuringRenderingPreventsArtifactCommitAndDisclosure()throws Exception{
        var s=source();Actor viewer=account();long member=join(s.actor(),s.workspace(),viewer);var grant=documents.grant(s.actor(),s.workspace(),s.document(),member,"EDITOR",s.version());int initial=storage.objects.size();renderer.entered=new CountDownLatch(1);renderer.release=new CountDownLatch(1);
        try(var pool=Executors.newSingleThreadExecutor()){
            var pending=pool.submit(()->exports.generate(viewer,s.workspace(),s.document(),grant.version(),"revoked-during-render"));assertThat(renderer.entered.await(20,TimeUnit.SECONDS)).isTrue();documents.revoke(s.actor(),s.workspace(),s.document(),member,grant.version());renderer.release.countDown();
            assertThatThrownBy(()->pending.get(20,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class).hasCauseInstanceOf(CapabilityException.class);
            assertThat(storage.objects).hasSize(initial);assertThat(jdbc.queryForObject("SELECT status FROM immutable_export WHERE workspace_id=? AND command_key='revoked-during-render'",String.class,s.workspace())).isEqualTo("FAILED_RETRYABLE");
        }finally{renderer.release.countDown();renderer.entered=null;renderer.release=null;}
    }
    @Test void generationAndRetriesRequireEditEvenWhenReadRemains(){
        var s=source();Actor editor=account();long membership=join(s.actor(),s.workspace(),editor);
        var grant=documents.grant(s.actor(),s.workspace(),s.document(),membership,"EDITOR",s.version());
        renderer.fail=true;var failed=exports.generate(editor,s.workspace(),s.document(),grant.version(),"editor-failed");assertThat(failed.status()).isEqualTo("FAILED_RETRYABLE");
        var completed=exports.generate(editor,s.workspace(),s.document(),grant.version(),"editor-completed");assertThat(completed.status()).isEqualTo("SUCCEEDED");byte[] artifact=exports.download(editor,s.workspace(),s.document(),completed.id()).bytes();
        var demoted=documents.grant(s.actor(),s.workspace(),s.document(),membership,"VIEWER",grant.version());
        int renders=renderer.calls.get(),puts=storage.puts;long commands=jdbc.queryForObject("SELECT COUNT(*) FROM immutable_export WHERE workspace_id=?",Long.class,s.workspace());
        denied(()->exports.generate(editor,s.workspace(),s.document(),demoted.version(),"viewer-new"),403);
        denied(()->exports.generate(editor,s.workspace(),s.document(),grant.version(),"editor-failed"),403);
        denied(()->exports.generate(editor,s.workspace(),s.document(),grant.version(),"editor-completed"),403);
        assertThat(renderer.calls.get()).isEqualTo(renders);assertThat(storage.puts).isEqualTo(puts);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM immutable_export WHERE workspace_id=?",Long.class,s.workspace())).isEqualTo(commands);
        assertThat(exports.get(editor,s.workspace(),s.document(),failed.id()).status()).isEqualTo("FAILED_RETRYABLE");assertThat(exports.list(editor,s.workspace(),s.document())).hasSize(2);assertThat(exports.download(editor,s.workspace(),s.document(),completed.id()).bytes()).isEqualTo(artifact);
        workspace.remove(s.actor(),s.workspace(),membership);denied(()->exports.generate(editor,s.workspace(),s.document(),grant.version(),"editor-completed"),403);denied(()->exports.download(editor,s.workspace(),s.document(),completed.id()),403);
    }
    @Test void demotionDuringRenderingBlocksArtifactCommitDespiteRemainingRead()throws Exception{
        var s=source();Actor editor=account();long membership=join(s.actor(),s.workspace(),editor);var grant=documents.grant(s.actor(),s.workspace(),s.document(),membership,"EDITOR",s.version());
        int initial=storage.objects.size();renderer.entered=new CountDownLatch(1);renderer.release=new CountDownLatch(1);
        try(var pool=Executors.newSingleThreadExecutor()){
            var pending=pool.submit(()->exports.generate(editor,s.workspace(),s.document(),grant.version(),"demoted-during-render"));assertThat(renderer.entered.await(20,TimeUnit.SECONDS)).isTrue();
            documents.grant(s.actor(),s.workspace(),s.document(),membership,"VIEWER",grant.version());renderer.release.countDown();
            var result=pending.get(20,TimeUnit.SECONDS);assertThat(result.status()).isEqualTo("FAILED_RETRYABLE");assertThat(result.artifactHash()).isNull();assertThat(result.byteSize()).isNull();assertThat(storage.objects).hasSize(initial);
            assertThat(jdbc.queryForObject("SELECT object_key FROM immutable_export WHERE id=?",String.class,result.id())).isNull();
            denied(()->exports.download(editor,s.workspace(),s.document(),result.id()),409);denied(()->exports.generate(editor,s.workspace(),s.document(),grant.version(),"demoted-during-render"),403);
        }finally{renderer.release.countDown();renderer.entered=null;renderer.release=null;}
    }
    @Test void koreanPdfWrapsAndPaginatesWithVisualEvidence()throws Exception{
        var s=source();var updated=setlists.update(s.actor(),s.workspace(),s.document(),"긴 콘티",("한글 메모와 English 123 - 줄바꿈 테스트\n").repeat(150),s.version());var export=exports.generate(s.actor(),s.workspace(),s.document(),updated.version(),"long-pdf");assertThat(export.status()).isEqualTo("SUCCEEDED");byte[] bytes=download(s,export.id());
        try(var pdf=Loader.loadPDF(bytes)){assertThat(pdf.getNumberOfPages()).isGreaterThan(2);String content=new PDFTextStripper().getText(pdf);assertThat(content).contains("긴 콘티","한글 메모와 English","주님의 은혜");Path evidence=Path.of("build/reports/export");Files.createDirectories(evidence);Files.write(evidence.resolve("setlist.pdf"),bytes);var image=new PDFRenderer(pdf).renderImageWithDPI(0,96);ImageIO.write(image,"png",evidence.resolve("first-page.png").toFile());assertThat(image.getWidth()).isGreaterThan(500);}
    }
}
