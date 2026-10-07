package com.worship.core;
import java.util.*;
import java.util.concurrent.*;
import com.worship.core.document.application.*;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.WorkspaceService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc @Testcontainers
@Import({WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class DocumentIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @Autowired DocumentService documents;@Autowired WorkspaceService workspace;@Autowired IdentityService identity;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;@Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    @Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;
    @Autowired DocumentAuthorizationPolicy policy;
    @Autowired org.springframework.transaction.support.TransactionTemplate tx;
    @Autowired com.worship.core.workspace.application.MemberNoticeService notices;
    @Autowired com.worship.core.identity.application.ProfileService profiles;
    Actor account(){String address=UUID.randomUUID()+"@example.org";identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    long join(Actor admin,long workspaceId,Actor user){String address=identity.get(user).emails().getFirst().email();workspace.invite(admin,workspaceId,address,UUID.randomUUID().toString());return workspace.accept(user,invitations.tokens.get(address)).id();}
    void denied(Runnable work,int code){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(code);}
    Cookie cookie(Actor actor)throws Exception{String address=identity.get(actor).emails().getFirst().email();return mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\""+address+"\",\"password\":\""+IdentityIntegrationTest.PASSWORD+"\"}")).andExpect(status().isNoContent()).andReturn().getResponse().getCookie("SESSION");}

    @Test void impactFingerprintsSupportManyDocumentsWithoutApplyingLoginTokenLengthLimit(){
        Actor admin=account(),creator=account();String name="긴 공간 이름 "+"가".repeat(180);long w=workspace.create(admin,name).id(),m=join(admin,w,creator);
        for(int i=0;i<100;i++)documents.create(creator,w,"private-"+i,"RESTRICTED");
        var removal=workspace.removalPreview(admin,w,m);assertThat(removal.affectedDocumentCount()).isEqualTo(100);assertThat(removal.confirmation()).hasSize(64);
        var closing=workspace.terminationPreview(admin,w);assertThat(closing.documentCount()).isEqualTo(100);assertThat(closing.confirmation()).hasSize(64);
        workspace.remove(admin,w,m,removal.confirmation());assertThat(documents.list(admin,w)).hasSize(100);
        denied(()->workspace.terminate(admin,w,name,closing.confirmation()),409);workspace.terminate(admin,w,name,workspace.terminationPreview(admin,w).confirmation());
    }

    @Test void confirmedRemovalInheritsAllSoleManagerDocumentsWithoutDisclosingRestrictedTitles(){
        Actor admin=account(),creator=account();long w=workspace.create(admin,"Inheritance").id(),m=join(admin,w,creator);
        var first=documents.create(creator,w,"hidden-one","RESTRICTED");var second=documents.create(creator,w,"hidden-two","RESTRICTED");
        long a=workspace.members(admin,w).stream().filter(n->n.userId()==admin.userId()).findFirst().orElseThrow().id();
        documents.grant(creator,w,second.id(),a,"VIEWER",0);
        var impact=workspace.removalPreview(admin,w,m);assertThat(impact.affectedDocumentCount()).isEqualTo(2);
        assertThat(Arrays.stream(impact.getClass().getRecordComponents()).map(java.lang.reflect.RecordComponent::getName)).containsExactly("membershipId","affectedDocumentCount","confirmation");
        denied(()->documents.get(admin,w,first.id()),403);denied(()->workspace.remove(admin,w,m),409);denied(()->workspace.remove(admin,w,m,"0".repeat(64)),409);
        assertThat(workspace.responsibilities(creator,w).soleManagerDocumentCount()).isEqualTo(2);assertThat(workspace.responsibilities(creator,w).canLeave()).isFalse();
        workspace.remove(admin,w,m,impact.confirmation());
        assertThat(documents.get(admin,w,first.id()).version()).isEqualTo(1);assertThat(documents.get(admin,w,second.id()).version()).isEqualTo(2);
        assertThat(documents.grants(admin,w,first.id())).extracting(DocumentService.GrantView::membershipId).containsExactly(a);
        assertThat(documents.grants(admin,w,second.id())).extracting(DocumentService.GrantView::role).containsExactly("MANAGER");
        denied(()->documents.get(creator,w,first.id()),403);denied(()->documents.changeAccess(admin,w,first.id(),"OPEN",0),409);
        assertThat(notices.list(admin,null)).filteredOn(n->n.kind().equals("MANAGER_ASSIGNED")).hasSize(2);
        assertThat(jdbc.queryForObject("SELECT role FROM document_grant WHERE document_id=? AND membership_id=?",String.class,first.id(),m)).isEqualTo("MANAGER");
        assertThat(jdbc.queryForObject("SELECT state FROM workspace_membership WHERE id=?",String.class,m)).isEqualTo("ENDED");
    }
    @Test void changedRemovalImpactRequiresReconfirmationAndOtherManagersPreventUnnecessarySuccession(){
        Actor admin=account(),creator=account(),remaining=account();long w=workspace.create(admin,"Impact changes").id(),m=join(admin,w,creator),c=join(admin,w,remaining);
        var document=documents.create(creator,w,"restricted-impact-title","RESTRICTED");var old=workspace.removalPreview(admin,w,m);
        documents.grant(creator,w,document.id(),c,"MANAGER",0);
        denied(()->workspace.remove(admin,w,m,old.confirmation()),409);assertThat(workspace.members(admin,w)).hasSize(3);
        var current=workspace.removalPreview(admin,w,m);assertThat(current.affectedDocumentCount()).isZero();workspace.remove(admin,w,m,current.confirmation());
        denied(()->documents.get(admin,w,document.id()),403);assertThat(documents.grants(remaining,w,document.id())).extracting(DocumentService.GrantView::membershipId).containsExactly(c);
        assertThat(notices.list(admin,null)).noneMatch(n->n.kind().equals("MANAGER_ASSIGNED"));denied(()->workspace.leave(remaining,w),409);denied(()->identity.withdraw(remaining),409);
    }
    @Test void secondSuccessionNoticeFailureRollsBackEveryGrantVersionAndMembership(){
        Actor admin=account(),creator=account();long w=workspace.create(admin,"Atomic inheritance").id(),m=join(admin,w,creator);long a=workspace.members(admin,w).getFirst().id();
        var first=documents.create(creator,w,"First","RESTRICTED");var second=documents.create(creator,w,"Second","RESTRICTED");var impact=workspace.removalPreview(admin,w,m);
        long events=jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Long.class,w),count=jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Long.class,w);
        jdbc.execute("ALTER TABLE member_notice ADD CONSTRAINT fail_second_inheritance CHECK (document_id IS NULL OR recipient_membership_id<>"+a+" OR document_id<>"+second.id()+")");
        try{assertThatThrownBy(()->workspace.remove(admin,w,m,impact.confirmation())).isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("fail_second_inheritance");}
        finally{jdbc.execute("ALTER TABLE member_notice DROP CHECK fail_second_inheritance");}
        assertThat(workspace.members(admin,w)).hasSize(2);
        for(long d:List.of(first.id(),second.id())){assertThat(documents.get(creator,w,d).version()).isZero();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM document_grant WHERE document_id=? AND membership_id=?",Integer.class,d,a)).isZero();denied(()->documents.get(admin,w,d),403);}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Long.class,w)).isEqualTo(events);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Long.class,w)).isEqualTo(count);
        workspace.remove(admin,w,m,impact.confirmation());assertThat(documents.list(admin,w)).hasSize(2);
    }
    @Test void permissionsGrantListingAndManagerNoticesAlwaysUseCurrentRole(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Role views").id(),m=join(admin,w,member);var d=documents.create(admin,w,"Restricted","RESTRICTED");
        denied(()->documents.permissions(member,w,d.id()),403);denied(()->documents.grants(member,w,d.id()),403);
        documents.grant(admin,w,d.id(),m,"MANAGER",0);assertThat(documents.permissions(member,w,d.id())).isEqualTo(new DocumentAuthorizationPolicy.Permissions(true,true,true,"MANAGER"));assertThat(documents.grants(member,w,d.id())).hasSize(2);
        documents.grant(admin,w,d.id(),m,"MANAGER",1);assertThat(notices.list(member,null)).hasSize(1);
        documents.grant(admin,w,d.id(),m,"VIEWER",2);assertThat(documents.permissions(member,w,d.id())).isEqualTo(new DocumentAuthorizationPolicy.Permissions(true,false,false,"VIEWER"));denied(()->documents.grants(member,w,d.id()),403);
        long notice=notices.list(member,null).getFirst().id();documents.revoke(admin,w,d.id(),m,3);assertThat(notices.list(member,null)).isEmpty();denied(()->notices.markRead(member,notice),404);
        var open=documents.create(admin,w,"Open","OPEN");assertThat(documents.permissions(member,w,open.id())).isEqualTo(new DocumentAuthorizationPolicy.Permissions(true,false,false,null));
    }
    @Test void removalAndManagerChangeRaceCannotUseAnOldConfirmation()throws Exception{
        Actor admin=account(),creator=account(),other=account();long w=workspace.create(admin,"Removal race").id(),m=join(admin,w,creator),c=join(admin,w,other);
        var d=documents.create(creator,w,"Race restricted","RESTRICTED");var impact=workspace.removalPreview(admin,w,m);
        try(var pool=Executors.newFixedThreadPool(2)){
            var barrier=new CyclicBarrier(2);
            var removal=pool.submit(()->{barrier.await();try{workspace.remove(admin,w,m,impact.confirmation());return "OK";}catch(CapabilityException e){assertThat(e.status()).isEqualTo(409);assertThat(e.code()).isEqualTo("STATE_CONFLICT");return "RECONFIRM";}});
            var change=pool.submit(()->{barrier.await();try{documents.grant(creator,w,d.id(),c,"MANAGER",0);return "OK";}catch(CapabilityException e){assertThat(e.status()).isEqualTo(403);assertThat(e.code()).isEqualTo("ACCESS_DENIED");return "DENIED";}});
            String r=removal.get(20,TimeUnit.SECONDS),g=change.get(20,TimeUnit.SECONDS);assertThat((r.equals("OK")?1:0)+(g.equals("OK")?1:0)).isEqualTo(1);
            if(r.equals("OK")){assertThat(documents.permissions(admin,w,d.id()).canManage()).isTrue();denied(()->documents.get(creator,w,d.id()),403);}
            else{denied(()->documents.get(admin,w,d.id()),403);assertThat(workspace.members(admin,w)).hasSize(3);assertThat(documents.grants(other,w,d.id())).hasSize(2);}
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM document_grant g JOIN workspace_membership m ON m.workspace_id=g.workspace_id AND m.id=g.membership_id WHERE g.document_id=? AND g.role='MANAGER' AND m.state='ACTIVE'",Long.class,d.id())).isGreaterThanOrEqualTo(1);
    }

    @Test void displayNamesAreSharedWithoutEmailsAndNeverChangeAuthorization(){
        Actor admin=account(),member=account(),outsider=account();long w=workspace.create(admin,"Names").id();profiles.update(admin,"민지");profiles.update(member,"준호");long m=join(admin,w,member);
        assertThat(workspace.members(admin,w)).extracting(com.worship.core.workspace.application.WorkspaceService.MemberView::displayName).containsExactly("민지","준호");
        assertThat(Arrays.stream(com.worship.core.workspace.application.WorkspaceService.MemberView.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName)).doesNotContain("email");
        denied(()->workspace.members(outsider,w),403);profiles.update(member,"민지");denied(()->workspace.invite(member,w,"next@example.org","name-is-not-admin"),403);
        denied(()->profiles.update(member," "),400);denied(()->profiles.update(member,"x".repeat(81)),400);denied(()->profiles.update(member,"bad\nname"),400);
        identity.withdraw(member);assertThat(jdbc.queryForObject("SELECT display_name FROM user_account WHERE id=?",String.class,member.userId())).isNull();denied(()->profiles.get(member),401);
        assertThat(workspace.members(admin,w)).hasSize(1);assertThat(jdbc.queryForObject("SELECT state FROM workspace_membership WHERE id=?",String.class,m)).isEqualTo("ENDED");
    }

    @Test void openAllowsActiveMembersOnlyAndGrantIsRequiredForEditing(){
        Actor admin=account(),member=account(),outsider=account();long id=workspace.create(admin,"Worship").id();join(admin,id,member);var doc=documents.create(member,id,"Open","OPEN");
        assertThat(doc.version()).isZero();assertThat(doc.type()).isEqualTo("SETLIST");assertThat(documents.get(admin,id,doc.id()).title()).isEqualTo("Open");denied(()->documents.get(outsider,id,doc.id()),403);
        denied(()->documents.changeAccess(admin,id,doc.id(),"RESTRICTED",0),403);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM setlist WHERE document_id=?",Integer.class,doc.id())).isEqualTo(1);
    }
    @Test void restrictedHasNoAdminBypassAndListAndHttpConcealMetadata()throws Exception{
        Actor admin=account(),creator=account();long id=workspace.create(admin,"Worship").id();join(admin,id,creator);var doc=documents.create(creator,id,"secret-document-title","RESTRICTED");
        denied(()->documents.get(admin,id,doc.id()),403);assertThat(documents.list(admin,id)).isEmpty();assertThat(documents.list(creator,id)).hasSize(1);
        var response=mvc.perform(get("/api/workspaces/"+id+"/documents/"+doc.id()).cookie(cookie(admin))).andExpect(status().isForbidden()).andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain("secret-document-title");
    }
    @Test void roleMatrixAppliesToReadEditAndManage(){
        Actor owner=account(),viewer=account(),editor=account(),manager=account();long id=workspace.create(owner,"Worship").id();long viewerId=join(owner,id,viewer),editorId=join(owner,id,editor),managerId=join(owner,id,manager);
        var doc=documents.create(owner,id,"Restricted","RESTRICTED");doc=documents.grant(owner,id,doc.id(),viewerId,"VIEWER",doc.version());doc=documents.grant(owner,id,doc.id(),editorId,"EDITOR",doc.version());doc=documents.grant(owner,id,doc.id(),managerId,"MANAGER",doc.version());
        long documentId=doc.id(),version=doc.version();
        assertThat(documents.get(viewer,id,documentId)).isNotNull();assertThat(documents.get(editor,id,documentId)).isNotNull();assertThat(documents.get(manager,id,documentId)).isNotNull();
        denied(()->documents.grant(viewer,id,documentId,viewerId,"EDITOR",version),403);denied(()->documents.grant(editor,id,documentId,viewerId,"EDITOR",version),403);
        var changed=documents.changeAccess(manager,id,documentId,"OPEN",version);assertThat(changed.version()).isEqualTo(version+1);
        denied(()->tx.executeWithoutResult(status->policy.require(viewer,id,documentId,DocumentAuthorizationPolicy.Action.EDIT)),403);
        assertThat(tx.<Long>execute(status->policy.require(editor,id,documentId,DocumentAuthorizationPolicy.Action.EDIT).id())).isEqualTo(documentId);
        assertThat(tx.<Long>execute(status->policy.require(manager,id,documentId,DocumentAuthorizationPolicy.Action.EDIT).id())).isEqualTo(documentId);
        denied(()->documents.changeAccess(editor,id,documentId,"RESTRICTED",changed.version()),403);
    }
    @Test void staleDocumentMutationsAndForeignMembershipGrantsAreRejected(){
        Actor admin=account(),other=account();long id=workspace.create(admin,"First").id(),foreign=workspace.create(other,"Foreign").id();long foreignMember=workspace.members(other,foreign).getFirst().id();
        var doc=documents.create(admin,id,"First","OPEN");var updated=documents.changeAccess(admin,id,doc.id(),"RESTRICTED",doc.version());
        denied(()->documents.changeAccess(admin,id,doc.id(),"OPEN",doc.version()),409);denied(()->documents.grant(admin,id,doc.id(),foreignMember,"VIEWER",updated.version()),404);
        denied(()->documents.get(admin,id,documents.create(other,foreign,"Foreign","OPEN").id()),404);
        assertThatThrownBy(()->jdbc.update("INSERT INTO document_grant(workspace_id,document_id,membership_id,role) VALUES(?,?,?,'VIEWER')",id,doc.id(),foreignMember)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void soleManagerCannotBeDemotedRevokedRemovedLeaveOrWithdraw(){
        Actor admin=account(),creator=account();long id=workspace.create(admin,"Worship").id();long memberId=join(admin,id,creator);var doc=documents.create(creator,id,"Restricted","RESTRICTED");
        denied(()->documents.grant(creator,id,doc.id(),memberId,"EDITOR",0),409);denied(()->documents.revoke(creator,id,doc.id(),memberId,0),409);
        denied(()->workspace.remove(admin,id,memberId),409);denied(()->workspace.leave(creator,id),409);denied(()->identity.withdraw(creator),409);
        long adminId=workspace.members(admin,id).stream().filter(m->m.userId()==admin.userId()).findFirst().orElseThrow().id();documents.grant(creator,id,doc.id(),adminId,"MANAGER",0);workspace.remove(admin,id,memberId);
        denied(()->documents.get(creator,id,doc.id()),403);
    }
    @Test void rejoiningMembershipNeverRestoresItsFormerGrant(){
        Actor admin=account(),member=account();long id=workspace.create(admin,"Worship").id();long first=join(admin,id,member);var doc=documents.create(admin,id,"Restricted","RESTRICTED");documents.grant(admin,id,doc.id(),first,"VIEWER",0);
        workspace.remove(admin,id,first);long second=join(admin,id,member);assertThat(second).isNotEqualTo(first);denied(()->documents.get(member,id,doc.id()),403);assertThat(documents.list(member,id)).isEmpty();
    }
    @Test void concurrentManagersCannotBothRemoveTheirGrant()throws Exception{
        Actor first=account(),second=account();long id=workspace.create(first,"Worship").id();long secondId=join(first,id,second);long firstId=workspace.members(first,id).stream().filter(m->m.userId()==first.userId()).findFirst().orElseThrow().id();var doc=documents.create(first,id,"Restricted","RESTRICTED");var updated=documents.grant(first,id,doc.id(),secondId,"MANAGER",0);
        try(var executor=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);Callable<Boolean> a=()->{barrier.await();return revokeRace(first,id,doc.id(),firstId,updated.version());};Callable<Boolean> b=()->{barrier.await();return revokeRace(second,id,doc.id(),secondId,updated.version());};var one=executor.submit(a);var two=executor.submit(b);assertThat((one.get(20,TimeUnit.SECONDS)?1:0)+(two.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM document_grant WHERE document_id=? AND role='MANAGER'",Integer.class,doc.id())).isEqualTo(1);
    }
    boolean revokeRace(Actor actor,long workspaceId,long documentId,long membershipId,long version){try{documents.revoke(actor,workspaceId,documentId,membershipId,version);return true;}catch(CapabilityException expected){
        assertThat(expected.status()).isEqualTo(409);assertThat(expected.code()).isEqualTo("VERSION_CONFLICT");return false;
    }}
    @Test void mutationMustSupplyExpectedVersionInHttp()throws Exception{
        Actor owner=account();long id=workspace.create(owner,"Worship").id();var doc=documents.create(owner,id,"Open","OPEN");
        mvc.perform(put("/api/workspaces/"+id+"/documents/"+doc.id()+"/access-policy").cookie(cookie(owner)).with(csrf()).contentType("application/json").content("{\"accessPolicy\":\"RESTRICTED\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
