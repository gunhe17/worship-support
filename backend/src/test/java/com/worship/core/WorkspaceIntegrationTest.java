package com.worship.core;

import java.util.*;
import java.util.concurrent.*;
import com.worship.core.identity.application.*;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.*;
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
@Import({WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class WorkspaceIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @TestConfiguration static class Fakes {@Bean @Primary FakeInvitations invitations(){return new FakeInvitations();}}
    static class FakeInvitations implements InvitationSender {
        final Map<String,String> tokens=new ConcurrentHashMap<>();volatile boolean fail;volatile Runnable afterSend;int sent;
        public void sendInvitation(String email,String name,String token){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();if(fail)throw new IllegalStateException("simulated failure");tokens.put(email,token);sent++;var callback=afterSend;afterSend=null;if(callback!=null)callback.run();}
    }
    @Autowired WorkspaceService workspace;
    @Autowired MemberNoticeService notices;
    @Autowired IdentityService identity;
    @Autowired IdentityIntegrationTest.CapturingEmailSender email;
    @Autowired FakeInvitations invitations;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.worship.core.document.application.DocumentService documents;
    private String address(){return UUID.randomUUID()+"@example.org";}
    private Actor account(String address){identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(email.latest(address,false));return identity.login(address,IdentityIntegrationTest.PASSWORD);}
    private Actor account(){return account(address());}
    private WorkspaceService.MemberView join(Actor admin,long id,Actor user){String target=identity.get(user).emails().getFirst().email();workspace.invite(admin,id,target,UUID.randomUUID().toString());return workspace.accept(user,invitations.tokens.get(target));}
    private void expectStatus(Runnable work,int status){var failure=catchThrowable(work::run);assertThat(failure).isInstanceOf(CapabilityException.class);assertThat(((CapabilityException)failure).status()).isEqualTo(status);}

    @Test void terminationEndsAllMembersInvitationsAndAccessButPreservesContentAndOwnMinimalNotice(){
        Actor admin=account(),member=account(),past=account(),outsider=account(),pending=account();long w=workspace.create(admin,"종료 공간").id();join(admin,w,member);join(admin,w,past);workspace.leave(past,w);
        long d=documents.create(member,w,"ADMIN에게 보이지 않는 제목","RESTRICTED").id();String address=identity.get(pending).emails().getFirst().email();var invite=workspace.invite(admin,w,address,"termination-pending");
        expectStatus(()->workspace.terminationPreview(member,w),403);expectStatus(()->workspace.terminationStatus(outsider,w),404);
        var preview=workspace.terminationPreview(admin,w);assertThat(preview.activeMemberCount()).isEqualTo(2);assertThat(preview.documentCount()).isEqualTo(1);assertThat(preview.ongoingWork()).isFalse();assertThat(preview.warnings()).hasSize(4).noneMatch(v->v.contains("보이지 않는 제목"));
        expectStatus(()->workspace.terminate(admin,w,"잘못된 이름",preview.confirmation()),400);expectStatus(()->workspace.terminate(member,w,"종료 공간",preview.confirmation()),403);
        var ended=workspace.terminate(admin,w,"종료 공간",preview.confirmation());assertThat(ended.state()).isEqualTo("TERMINATED");assertThat(workspace.terminationStatus(member,w).terminatedAt()).isEqualTo(ended.terminatedAt());
        for(var actor:List.of(admin,member,past,outsider)){assertThat(workspace.list(actor)).noneMatch(v->v.id()==w);expectStatus(()->workspace.get(actor,w),404);expectStatus(()->workspace.members(actor,w),404);expectStatus(()->documents.get(actor,w,d),404);}
        for(var actor:List.of(past,outsider,pending))expectStatus(()->workspace.terminationStatus(actor,w),404);
        assertThat(notices.list(member,null)).hasSize(1).allMatch(n->n.kind().equals("WORKSPACE_TERMINATED")&&n.documentId()==null);notices.markRead(member,notices.list(member,null).getFirst().id());
        expectStatus(()->workspace.accept(pending,invitations.tokens.get(address)),404);expectStatus(()->workspace.invite(admin,w,address(),"closed"),404);expectStatus(()->workspace.terminate(admin,w,"종료 공간",preview.confirmation()),404);
        assertThat(jdbc.queryForObject("SELECT state FROM workspace_invitation WHERE id=?",String.class,invite.id())).isEqualTo("REVOKED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND state='ACTIVE'",Integer.class,w)).isZero();assertThat(jdbc.queryForObject("SELECT title FROM document WHERE id=?",String.class,d)).isEqualTo("ADMIN에게 보이지 않는 제목");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=? AND kind='WORKSPACE_TERMINATED'",Integer.class,w)).isEqualTo(2);
        identity.withdraw(admin);assertThat(identity.valid(admin)).isFalse();
    }
    @Test void terminationRequiresReconfirmationWhenDocumentsInvitationsOrMembershipsChange(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Reconfirm closure").id();var before=workspace.terminationPreview(admin,w);long d=documents.create(admin,w,"New","OPEN").id();
        expectStatus(()->workspace.terminate(admin,w,"Reconfirm closure",before.confirmation()),409);var documentPreview=workspace.terminationPreview(admin,w);documents.changeAccess(admin,w,d,"RESTRICTED",0);expectStatus(()->workspace.terminate(admin,w,"Reconfirm closure",documentPreview.confirmation()),409);
        var changed=workspace.terminationPreview(admin,w);workspace.invite(admin,w,address(),"new-invitation");expectStatus(()->workspace.terminate(admin,w,"Reconfirm closure",changed.confirmation()),409);
        var invited=workspace.terminationPreview(admin,w);join(admin,w,member);expectStatus(()->workspace.terminate(admin,w,"Reconfirm closure",invited.confirmation()),409);
        workspace.terminate(admin,w,"Reconfirm closure",workspace.terminationPreview(admin,w).confirmation());
    }
    @Test void secondTerminationNoticeFailureRollsBackStateMembersInvitesAndAudit(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Termination rollback").id(),m=join(admin,w,member).id();var invite=workspace.invite(admin,w,address(),"pending");var preview=workspace.terminationPreview(admin,w);
        int audits=jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Integer.class,w),count=jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Integer.class,w);
        jdbc.execute("ALTER TABLE member_notice ADD CONSTRAINT simulated_termination_failure CHECK (kind<>'WORKSPACE_TERMINATED' OR recipient_membership_id<>"+m+")");
        try{assertThatThrownBy(()->workspace.terminate(admin,w,"Termination rollback",preview.confirmation())).isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("simulated_termination_failure");}finally{jdbc.execute("ALTER TABLE member_notice DROP CHECK simulated_termination_failure");}
        assertThat(workspace.members(admin,w)).hasSize(2);assertThat(jdbc.queryForObject("SELECT state FROM workspace WHERE id=?",String.class,w)).isEqualTo("ACTIVE");assertThat(jdbc.queryForObject("SELECT state FROM workspace_invitation WHERE id=?",String.class,invite.id())).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Integer.class,w)).isEqualTo(audits);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Integer.class,w)).isEqualTo(count);
        workspace.terminate(admin,w,"Termination rollback",preview.confirmation());
    }
    @Test void terminationRacingInvitationAcceptanceNeverReopensOrDropsAnUnconfirmedMember()throws Exception{
        Actor admin=account(),member=account();long w=workspace.create(admin,"Close accept race").id();String address=identity.get(member).emails().getFirst().email();workspace.invite(admin,w,address,"race-invite");String token=invitations.tokens.get(address);var preview=workspace.terminationPreview(admin,w);
        try(var pool=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);var closing=pool.submit(()->{barrier.await();try{workspace.terminate(admin,w,"Close accept race",preview.confirmation());return true;}catch(CapabilityException failure){assertThat(failure.status()).isEqualTo(409);return false;}});var accepting=pool.submit(()->{barrier.await();try{workspace.accept(member,token);return true;}catch(CapabilityException failure){assertThat(failure.status()).isEqualTo(404);return false;}});boolean closed=closing.get(20,TimeUnit.SECONDS),accepted=accepting.get(20,TimeUnit.SECONDS);assertThat(closed).isNotEqualTo(accepted);if(accepted){assertThat(workspace.members(admin,w)).hasSize(2);workspace.terminate(admin,w,"Close accept race",workspace.terminationPreview(admin,w).confirmation());}}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND state='ACTIVE'",Integer.class,w)).isZero();expectStatus(()->workspace.accept(member,token),404);
    }
    @Test void terminationRacingAdminTransferHasOneWinnerAndRequiresCurrentAdmin()throws Exception{
        Actor admin=account(),member=account();long w=workspace.create(admin,"Close transfer race").id(),m=join(admin,w,member).id();var preview=workspace.terminationPreview(admin,w);
        try(var pool=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);var closing=pool.submit(()->{barrier.await();try{workspace.terminate(admin,w,"Close transfer race",preview.confirmation());return true;}catch(CapabilityException failure){assertThat(failure.status()).isEqualTo(403);return false;}});var transfer=pool.submit(()->{barrier.await();try{workspace.transferAdmin(admin,w,m);return true;}catch(CapabilityException failure){assertThat(failure.status()).isEqualTo(404);return false;}});assertThat(closing.get(20,TimeUnit.SECONDS)).isNotEqualTo(transfer.get(20,TimeUnit.SECONDS));}
        if(jdbc.queryForObject("SELECT state FROM workspace WHERE id=?",String.class,w).equals("ACTIVE")){expectStatus(()->workspace.terminate(member,w,"Close transfer race",preview.confirmation()),409);workspace.terminate(member,w,"Close transfer race",workspace.terminationPreview(member,w).confirmation());}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND state='ACTIVE'",Integer.class,w)).isZero();
    }
    @Test void invitationResponseRechecksTerminationAfterExternalDelivery(){
        Actor admin=account();long w=workspace.create(admin,"Close during invite").id();invitations.afterSend=()->workspace.terminate(admin,w,"Close during invite",workspace.terminationPreview(admin,w).confirmation());
        try{expectStatus(()->workspace.invite(admin,w,address(),"late-response"),404);}finally{invitations.afterSend=null;}
        assertThat(jdbc.queryForObject("SELECT state FROM workspace_invitation WHERE workspace_id=?",String.class,w)).isEqualTo("REVOKED");assertThat(workspace.terminationStatus(admin,w).state()).isEqualTo("TERMINATED");
    }

    @Test void databaseRejectsASecondActiveAdminWithoutChangingExistingRoles(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Single admin constraint").id();long m=join(admin,w,member).id();
        assertThatThrownBy(()->jdbc.update("UPDATE workspace_membership SET role='ADMIN' WHERE id=?",m))
            .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("single_active_admin");
        assertThat(jdbc.queryForObject("SELECT role FROM workspace_membership WHERE id=?",String.class,m)).isEqualTo("MEMBER");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND role='ADMIN' AND state='ACTIVE'",Integer.class,w)).isEqualTo(1);
    }

    @Test void adminTransferRevokesOldWorkspacePowerAndNotifiesOnlyTheRecipient(){
        Actor admin=account(),member=account(),outsider=account();long w=workspace.create(admin,"Transfer").id();long target=join(admin,w,member).id();
        long old=workspace.members(admin,w).stream().filter(m->m.userId()==admin.userId()).findFirst().orElseThrow().id();
        expectStatus(()->workspace.transferAdmin(admin,w,old),409);expectStatus(()->workspace.transferAdmin(member,w,old),403);
        workspace.transferAdmin(admin,w,target);
        assertThat(workspace.members(member,w)).filteredOn(m->m.id()==old).extracting(WorkspaceService.MemberView::role).containsExactly("MEMBER");
        expectStatus(()->workspace.invite(admin,w,address(),"no-longer-admin"),403);expectStatus(()->workspace.transferAdmin(admin,w,target),403);
        var notice=notices.list(member,null).getFirst();assertThat(notice.workspaceId()).isEqualTo(w);assertThat(notice.kind()).isEqualTo("ADMIN_ASSIGNED");assertThat(notice.documentId()).isNull();assertThat(notice.readAt()).isNull();
        assertThat(notices.list(outsider,null)).isEmpty();expectStatus(()->notices.markRead(outsider,notice.id()),404);
        notices.markRead(member,notice.id());var read=notices.list(member,null).getFirst().readAt();assertThat(read).isNotNull();notices.markRead(member,notice.id());assertThat(notices.list(member,null).getFirst().readAt()).isEqualTo(read);
        assertThat(notices.list(member,notice.id())).isEmpty();expectStatus(()->notices.list(member,0L),400);
        workspace.transferAdmin(member,w,old);workspace.leave(member,w);assertThat(notices.list(member,null)).isEmpty();expectStatus(()->notices.markRead(member,notice.id()),404);expectStatus(()->workspace.transferAdmin(admin,w,target),404);
        join(admin,w,member);assertThat(notices.list(member,null)).isEmpty();
    }
    @Test void noticeInsertFailureRollsBackBothAdminRolesAndAudit(){
        Actor admin=account(),member=account();long w=workspace.create(admin,"Notice rollback").id();long target=join(admin,w,member).id();
        long events=jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Long.class,w),noticeCount=jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Long.class,w);
        // Disposable DB CHECK injection needs no SUPER/trigger privilege and
        // fails the real notice INSERT after both role mutations were flushed.
        jdbc.execute("ALTER TABLE member_notice ADD CONSTRAINT simulated_notice_failure CHECK (recipient_membership_id <> "+target+")");
        try{assertThatThrownBy(()->workspace.transferAdmin(admin,w,target)).isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("simulated_notice_failure");}
        finally{jdbc.execute("ALTER TABLE member_notice DROP CHECK simulated_notice_failure");}
        assertThat(workspace.members(admin,w)).filteredOn(m->m.id()==target).extracting(WorkspaceService.MemberView::role).containsExactly("MEMBER");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND user_id=? AND role='ADMIN' AND state='ACTIVE'",Integer.class,w,admin.userId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE workspace_id=?",Long.class,w)).isEqualTo(events);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=?",Long.class,w)).isEqualTo(noticeCount);
    }
    @Test void simultaneousTransfersHaveOneWinnerAndOneCurrentAdmin()throws Exception{
        Actor admin=account(),b=account(),c=account();long w=workspace.create(admin,"Transfer race").id(),bm=join(admin,w,b).id(),cm=join(admin,w,c).id();
        try(var pool=Executors.newFixedThreadPool(2)){
            var barrier=new CyclicBarrier(2);
            var one=pool.submit(()->{barrier.await();return transferRace(admin,w,bm);});var two=pool.submit(()->{barrier.await();return transferRace(admin,w,cm);});
            assertThat((one.get(20,TimeUnit.SECONDS)?1:0)+(two.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND state='ACTIVE' AND role='ADMIN'",Integer.class,w)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM member_notice WHERE workspace_id=? AND recipient_membership_id IN (?,?)",Integer.class,w,bm,cm)).isEqualTo(1);
    }
    boolean transferRace(Actor actor,long w,long target){try{workspace.transferAdmin(actor,w,target);return true;}catch(CapabilityException failure){assertThat(failure.status()).isEqualTo(403);assertThat(failure.code()).isEqualTo("ACCESS_DENIED");return false;}}

    @Test void noticesPaginateWithoutOverlapAndScopedRecipientFkRejectsForeignMembership(){
        Actor admin=account(),foreign=account();long w=workspace.create(admin,"Notice pages").id(),other=workspace.create(foreign,"Other notice tenant").id();
        long m=workspace.members(admin,w).getFirst().id(),foreignMember=workspace.members(foreign,other).getFirst().id();
        assertThatThrownBy(()->jdbc.update("INSERT INTO member_notice(workspace_id,recipient_membership_id,kind,created_at) VALUES(?,?,'ADMIN_ASSIGNED',UTC_TIMESTAMP(6))",w,foreignMember))
            .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("notice_recipient");
        for(int i=0;i<101;i++)jdbc.update("INSERT INTO member_notice(workspace_id,recipient_membership_id,kind,created_at) VALUES(?,?,'ADMIN_ASSIGNED',UTC_TIMESTAMP(6))",w,m);
        var first=notices.list(admin,null);assertThat(first).hasSize(100);var next=notices.list(admin,first.getLast().id());assertThat(next).hasSize(2);
        assertThat(next).noneMatch(n->first.stream().anyMatch(previous->previous.id()==n.id()));
        assertThat(first).isSortedAccordingTo(Comparator.comparingLong(MemberNoticeService.NoticeView::id).reversed());
    }

    @Test void creatorIsAdminAndTenantAndMemberManagementAreEnforced(){
        Actor admin=account(),member=account(),outsider=account();long id=workspace.create(admin,"Worship").id();var membership=join(admin,id,member);
        assertThat(workspace.members(admin,id).stream().filter(m->m.userId()==admin.userId()).findFirst().orElseThrow().role()).isEqualTo("ADMIN");
        assertThat(workspace.get(member,id).name()).isEqualTo("Worship");expectStatus(()->workspace.get(outsider,id),403);
        expectStatus(()->workspace.invite(member,id,address(),"denied"),403);expectStatus(()->workspace.remove(member,id,membership.id()),403);
        long other=workspace.create(outsider,"Other").id();long foreign=workspace.members(outsider,other).getFirst().id();expectStatus(()->workspace.transferAdmin(admin,id,foreign),404);
        assertThat(workspace.list(outsider)).extracting(WorkspaceService.WorkspaceView::id).containsExactly(other);
        workspace.transferAdmin(admin,id,membership.id());expectStatus(()->workspace.remove(admin,id,membership.id()),403);expectStatus(()->workspace.remove(member,id,membership.id()),409);
    }
    @Test void invitationRequiresExactVerifiedEmailAndRejectsReplayRevokeAndExpiry(){
        Actor admin=account(),wrong=account();String target=address();Actor invited=account(target);long id=workspace.create(admin,"Worship").id();
        var invitation=workspace.invite(admin,id,"  "+target.toUpperCase(Locale.ROOT)+"  ","invite");String raw=invitations.tokens.get(target);
        expectStatus(()->workspace.accept(wrong,raw),403);assertThat(workspace.accept(invited,raw).role()).isEqualTo("MEMBER");expectStatus(()->workspace.accept(invited,raw),409);
        String revokedEmail=address();Actor revoked=account(revokedEmail);var revoke=workspace.invite(admin,id,revokedEmail,"revoke");workspace.revoke(admin,id,revoke.id());expectStatus(()->workspace.accept(revoked,invitations.tokens.get(revokedEmail)),409);
        String expiredEmail=address();Actor expired=account(expiredEmail);var expire=workspace.invite(admin,id,expiredEmail,"expired");jdbc.update("UPDATE workspace_invitation SET expires_at='2000-01-01' WHERE id=?",expire.id());expectStatus(()->workspace.accept(expired,invitations.tokens.get(expiredEmail)),400);
        assertThat(jdbc.queryForObject("SELECT state FROM workspace_invitation WHERE id=?",String.class,expire.id())).isEqualTo("EXPIRED");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM workspace_invitation WHERE id=?",String.class,invitation.id())).isNotEqualTo(raw);
    }
    @Test void secondaryVerifiedEmailCanAcceptButUnverifiedEmailCannot(){
        Actor admin=account(),invited=account();String secondary=address();identity.addEmail(invited,secondary);long id=workspace.create(admin,"Worship").id();workspace.invite(admin,id,secondary,"secondary");String raw=invitations.tokens.get(secondary);
        expectStatus(()->workspace.accept(invited,raw),403);identity.verify(email.latest(secondary,false));assertThat(workspace.accept(invited,raw).userId()).isEqualTo(invited.userId());
    }
    @Test void endedMembershipIsNotReactivatedOnRejoin(){
        Actor admin=account(),member=account();long id=workspace.create(admin,"Worship").id();var first=join(admin,id,member);workspace.remove(admin,id,first.id());expectStatus(()->workspace.get(member,id),403);
        var next=join(admin,id,member);assertThat(next.id()).isNotEqualTo(first.id());assertThat(jdbc.queryForObject("SELECT state FROM workspace_membership WHERE id=?",String.class,first.id())).isEqualTo("ENDED");
    }
    @Test void lastAdminCannotLeaveOrWithdrawAndConcurrentLeavesPreserveOne() throws Exception {
        Actor first=account(),second=account();long id=workspace.create(first,"Worship").id();expectStatus(()->workspace.leave(first,id),409);expectStatus(()->identity.withdraw(first),409);
        var membership=join(first,id,second);workspace.transferAdmin(first,id,membership.id());
        try(var executor=Executors.newFixedThreadPool(2)){
            var barrier=new CyclicBarrier(2);
            Callable<Boolean> a=()->{barrier.await();return leaveRace(first,id);};
            Callable<Boolean> b=()->{barrier.await();return leaveRace(second,id);};
            var one=executor.submit(a);var two=executor.submit(b);assertThat((one.get(20,TimeUnit.SECONDS)?1:0)+(two.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=? AND role='ADMIN' AND state='ACTIVE'",Integer.class,id)).isEqualTo(1);
    }
    boolean leaveRace(Actor actor,long id){try{workspace.leave(actor,id);return true;}catch(CapabilityException expected){
        assertThat(expected.status()).isEqualTo(409);assertThat(expected.code()).isEqualTo("STATE_CONFLICT");assertThat(expected.getMessage()).isEqualTo("Last ADMIN must transfer responsibility");return false;
    }}
    @Test void withdrawalIsAtomicAcrossWorkspacesAndTerminatesMembership(){
        Actor user=account(),other=account();long first=workspace.create(user,"First").id(),second=workspace.create(user,"Second").id();var otherMember=join(user,first,other);workspace.transferAdmin(user,first,otherMember.id());
        expectStatus(()->identity.withdraw(user),409);assertThat(workspace.get(user,first).id()).isEqualTo(first);
        var secondMember=join(user,second,other);workspace.transferAdmin(user,second,secondMember.id());identity.withdraw(user);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_membership WHERE user_id=? AND state='ACTIVE'",Integer.class,user.userId())).isZero();assertThat(identity.valid(user)).isFalse();
    }
    @Test void failedDeliveryCanResendAndCommandRetriesDoNotDuplicateInvitations(){
        Actor admin=account();long id=workspace.create(admin,"Worship").id();String target=address();WorkspaceService.InvitationView first;
        invitations.fail=true;try{first=workspace.invite(admin,id,target,"same-key");}finally{invitations.fail=false;}
        assertThat(first.deliveryStatus()).isEqualTo("FAILED_RETRYABLE");assertThat(workspace.invite(admin,id,target,"same-key").id()).isEqualTo(first.id());
        int before=invitations.sent;workspace.resend(admin,id,first.id(),"resend-key");String token=invitations.tokens.get(target);workspace.resend(admin,id,first.id(),"resend-key");
        assertThat(invitations.sent).isEqualTo(before+1);assertThat(invitations.tokens.get(target)).isEqualTo(token);
        expectStatus(()->workspace.invite(admin,id,address(),"same-key"),409);
    }
}
