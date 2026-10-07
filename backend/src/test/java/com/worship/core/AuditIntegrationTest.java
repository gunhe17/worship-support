package com.worship.core;

import java.time.*;
import java.util.*;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.audit.application.AuditRecorder.*;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.workspace.application.WorkspaceService;
import com.worship.core.document.application.DocumentService;
import com.worship.core.integration.youtube.YouTubeAuthorizationService;
import com.worship.core.shared.application.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties="worship.credentials.key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") @Testcontainers
@Import({IdentityIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,YouTubeIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class AuditIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @Autowired IdentityService identity;@Autowired WorkspaceService workspaces;@Autowired DocumentService documents;
    @Autowired YouTubeAuthorizationService youtube;@Autowired YouTubeIntegrationTest.FakeYouTube provider;
    @Autowired IdentityIntegrationTest.CapturingEmailSender mail;@Autowired WorkspaceIntegrationTest.FakeInvitations invitations;
    @Autowired AuditRecorder audit;@Autowired JdbcTemplate jdbc;@Autowired TransactionTemplate tx;
    Actor account(){String email=UUID.randomUUID()+"@example.org";identity.signup(email,IdentityIntegrationTest.PASSWORD);identity.verify(mail.latest(email,false));return identity.login(email,IdentityIntegrationTest.PASSWORD);}
    long join(Actor owner,long workspace,Actor member){String email=identity.get(member).emails().getFirst().email();workspaces.invite(owner,workspace,email,UUID.randomUUID().toString());return workspaces.accept(member,invitations.tokens.get(email)).id();}
    Map<String,Object> event(long actor,String event){return jdbc.queryForMap("SELECT * FROM audit_log WHERE actor_id=? AND event=? ORDER BY id DESC LIMIT 1",actor,event);}
    @Test void tenantMembershipAndGrantChangesIdentifyAffectedResourcesAndOldNewRoles(){
        var owner=account();var member=account();long w=workspaces.create(owner,"Audit target").id();long m=join(owner,w,member);
        assertThat(event(owner.userId(),"WORKSPACE_CREATED")).containsEntry("workspace_id",w).containsEntry("target_id",w).containsEntry("target_type","WORKSPACE");
        workspaces.transferAdmin(owner,w,m);assertThat(event(owner.userId(),"ADMIN_ASSIGNED")).containsEntry("workspace_id",w).containsEntry("membership_id",m).containsEntry("change_field","ROLE").containsEntry("before_value","MEMBER").containsEntry("after_value","ADMIN");
        assertThat(event(owner.userId(),"ADMIN_RELEASED")).containsEntry("before_value","ADMIN").containsEntry("after_value","MEMBER");
        var d=documents.create(owner,w,"Sensitive title never audited","RESTRICTED");documents.grant(owner,w,d.id(),m,"EDITOR",0);documents.grant(owner,w,d.id(),m,"VIEWER",1);
        var grant=event(owner.userId(),"DOCUMENT_GRANT_CHANGED");assertThat(grant).containsEntry("workspace_id",w).containsEntry("document_id",d.id()).containsEntry("membership_id",m).containsEntry("target_type","DOCUMENT_GRANT").containsEntry("before_value","EDITOR").containsEntry("after_value","VIEWER");assertThat(((Number)grant.get("target_id")).longValue()).isPositive();
        documents.changeAccess(owner,w,d.id(),"OPEN",2);assertThat(event(owner.userId(),"DOCUMENT_ACCESS_CHANGED")).containsEntry("before_value","RESTRICTED").containsEntry("after_value","OPEN");
        documents.revoke(owner,w,d.id(),m,3);assertThat(event(owner.userId(),"DOCUMENT_GRANT_REVOKED")).containsEntry("target_id",grant.get("target_id")).containsEntry("before_value","VIEWER").containsEntry("after_value",null);
        long ownerMembership=workspaces.members(member,w).stream().filter(n->n.userId()==owner.userId()).findFirst().orElseThrow().id();workspaces.transferAdmin(member,w,ownerMembership);
        workspaces.leave(member,w);assertThat(event(member.userId(),"WORKSPACE_LEFT")).containsEntry("membership_id",m).containsEntry("before_value","ACTIVE").containsEntry("after_value","ENDED");
        long rejoined=join(owner,w,member);assertThat(rejoined).isNotEqualTo(m);assertThat(event(member.userId(),"INVITATION_ACCEPTED")).containsEntry("membership_id",rejoined);assertThat(event(member.userId(),"WORKSPACE_LEFT")).containsEntry("membership_id",m);
    }
    @Test void deniedAndRolledBackLifecycleNeverPersistSuccessEventsOrPartialChanges(){
        var owner=account();var other=account();long first=workspaces.create(owner,"First").id(),second=workspaces.create(owner,"Second").id();long m=join(owner,first,other);workspaces.transferAdmin(owner,first,m);
        long before=jdbc.queryForObject("SELECT COUNT(*) FROM audit_log",Long.class);
        assertThatThrownBy(()->identity.withdraw(owner)).isInstanceOf(CapabilityException.class).hasMessage("Last ADMIN must transfer responsibility")
            .satisfies(failure->assertThat(((CapabilityException)failure).code()).isEqualTo("STATE_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log",Long.class)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE user_id=? AND state='ACTIVE'",Long.class,owner.userId())).isEqualTo(2);
        long otherMember=join(owner,second,other);workspaces.transferAdmin(owner,second,otherMember);identity.withdraw(owner);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE actor_id=? AND event='MEMBERSHIP_WITHDRAWN' AND after_value='ENDED'",Long.class,owner.userId())).isEqualTo(2);
        assertThat(event(owner.userId(),"ACCOUNT_WITHDRAWN")).containsEntry("target_type","USER").containsEntry("target_id",owner.userId()).containsEntry("before_value","ACTIVE").containsEntry("after_value","WITHDRAWN");
    }
    @Test void deletedIdentityAndAuthorizationRemainTraceableWithoutStoringCredentials(){
        var user=account();String subject=UUID.randomUUID().toString();identity.googleLink(user,"https://accounts.google.com",subject);long id=identity.get(user).googleIdentityIds().getFirst();identity.unlinkGoogle(user,id);
        assertThat(event(user.userId(),"GOOGLE_UNLINKED")).containsEntry("target_type","GOOGLE_IDENTITY").containsEntry("target_id",id);
        String state=java.net.URI.create(youtube.start(user)).getRawQuery().substring(6);youtube.complete(user,state,"fake-code");long authorization=jdbc.queryForObject("SELECT id FROM youtube_authorization WHERE user_id=?",Long.class,user.userId());
        assertThat(event(user.userId(),"YOUTUBE_CONNECTED")).containsEntry("target_id",authorization).containsEntry("before_value","FALSE").containsEntry("after_value","TRUE");
        provider.failRevoke=true;try{assertThat(youtube.disconnect(user).revokeStatus()).isEqualTo("PROVIDER_REVOKE_FAILED");}finally{provider.failRevoke=false;}
        assertThat(event(user.userId(),"YOUTUBE_DISCONNECTED")).containsEntry("target_id",authorization).containsEntry("after_value","FALSE");
        String all=jdbc.queryForList("SELECT * FROM audit_log WHERE actor_id=?",user.userId()).toString();assertThat(all).doesNotContain(subject,"@example.org",IdentityIntegrationTest.PASSWORD,state,"fake-code","encrypted_refresh");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM youtube_authorization WHERE user_id=?",Long.class,user.userId())).isZero();
    }
    @Test void recordingRequiresTransactionAndRejectsSecretValuesAndCrossTenantTargets(){
        var user=account();long w=workspaces.create(user,"One").id(),other=workspaces.create(user,"Two").id();var doc=documents.create(user,w,"D","RESTRICTED");
        assertThatThrownBy(()->audit.record(user.userId(),"PROBE",Instant.now(),Target.document(w,doc.id()),null)).isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
        assertThatThrownBy(()->new Change(Field.ROLE,null,"secret@example.org")).isInstanceOf(IllegalArgumentException.class);
        long before=jdbc.queryForObject("SELECT COUNT(*) FROM audit_log",Long.class);
        assertThatThrownBy(()->tx.executeWithoutResult(s->audit.record(user.userId(),"PROBE",Instant.now(),Target.document(other,doc.id()),null))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class).hasMessageContaining("audit_document");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log",Long.class)).isEqualTo(before);
        assertThatThrownBy(()->jdbc.update("INSERT INTO audit_log(actor_id,event,occurred_at,target_type,target_id,change_field,after_value) VALUES(?,'PROBE',UTC_TIMESTAMP(6),'USER',?,'ROLE','secret@example.org')",user.userId(),user.userId()))
            .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("audit_change").satisfies(DesignAssuranceIntegrationTest::assertMysqlCheckViolation);
        assertThatThrownBy(()->jdbc.update("INSERT INTO audit_log(actor_id,event,occurred_at,document_id) VALUES(?,'PROBE',UTC_TIMESTAMP(6),?)",user.userId(),doc.id()))
            .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("audit_context").satisfies(DesignAssuranceIntegrationTest::assertMysqlCheckViolation);
        tx.executeWithoutResult(s->{audit.record(user.userId(),"PROBE",Instant.now(),Target.document(w,doc.id()),null);s.setRollbackOnly();});assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log",Long.class)).isEqualTo(before);
    }
}
