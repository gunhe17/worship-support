package com.worship.core.workspace.application;

import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import com.worship.core.identity.application.*;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.audit.application.AuditRecorder.*;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.domain.*;
import com.worship.core.workspace.infrastructure.WorkspaceStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class WorkspaceService implements AccountLifecycle {
    private final IdentityServiceProvider identity;
    private final AuditRecorder accounts;
    private final WorkspaceStore store;
    private final InvitationSender sender;
    private final MemberNoticeRecorder notices;
    private final org.springframework.beans.factory.ObjectProvider<MembershipLifecycle> lifecycles;
    private final org.springframework.beans.factory.ObjectProvider<WorkspaceTerminationParticipant> terminationParticipants;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    // Provider resolves the intentional lifecycle callback cycle only when a capability executes.
    public WorkspaceService(org.springframework.beans.factory.ObjectProvider<IdentityService> identity,AuditRecorder accounts,WorkspaceStore store,
        InvitationSender sender,org.springframework.beans.factory.ObjectProvider<MembershipLifecycle> lifecycles,TransactionTemplate tx,Clock clock,MemberNoticeRecorder notices,org.springframework.beans.factory.ObjectProvider<WorkspaceTerminationParticipant> terminationParticipants){
        this.identity=identity::getObject;this.accounts=accounts;this.store=store;this.sender=sender;this.lifecycles=lifecycles;this.tx=tx;this.clock=clock;this.notices=notices;this.terminationParticipants=terminationParticipants;
    }
    private interface IdentityServiceProvider { IdentityService get(); }
    public record WorkspaceView(long id,String name) {}
    public record MemberView(long id,long userId,String displayName,String role,String state) {}
    public record InvitationView(long id,String email,String state,String deliveryStatus) {}
    public record RemovalPreview(long membershipId,int affectedDocumentCount,String confirmation) {}
    public record Responsibilities(boolean requiresAdminTransfer,int soleManagerDocumentCount,boolean canLeave) {}
    public record TerminationPreview(int activeMemberCount,int documentCount,boolean ongoingWork,String ongoingWorkScope,List<String> warnings,String confirmation) {}
    public record TerminationStatus(long workspaceId,String state,Instant terminatedAt) {}
    private static final List<String> TERMINATION_WARNINGS=List.of(
        "모든 구성원의 접근과 미수락 초대가 종료됩니다.",
        "종료는 즉시 영구 삭제가 아닙니다. 보존·삭제 기간은 아직 확정되지 않았습니다.",
        "V1에서는 재개·복구를 제공하지 않으며 운영자 복구도 보장하지 않습니다.",
        "이미 다운로드한 파일을 회수하거나 외부 서비스에 반영된 작업을 완전히 되돌릴 수 없습니다.");
    private record Send(long workspaceId,long invitationId,String name,String email,String raw) {}
    private WorkspaceView view(Workspace w){return new WorkspaceView(w.id(),w.name());}
    private MemberView view(Membership m){var data=store.memberData(m.workspaceId(),m.id()).getFirst();return new MemberView(data.id(),data.userId(),data.displayName(),data.role(),data.state());}
    private InvitationView view(Invitation i){return new InvitationView(i.id(),i.email(),"PENDING".equals(i.state())&&i.expired(clock.instant())?"EXPIRED":i.state(),i.deliveryStatus());}
    public WorkspaceView create(Actor actor,String name){
        if(name==null||name.isBlank()||name.length()>200)throw Errors.invalid("Workspace name required");
        return tx.execute(status->{
            var account=identity.get().getForChange(actor);
            if(account.emails().stream().noneMatch(IdentityService.EmailView::verified))throw Errors.forbidden();
            var workspace=new Workspace(name.trim(),clock.instant());store.save(workspace);
            var member=new Membership(workspace.id(),actor.userId(),"ADMIN");store.save(member);accounts.record(actor.userId(),"WORKSPACE_CREATED",clock.instant(),Target.workspace(workspace.id()),null);accounts.record(actor.userId(),"MEMBERSHIP_CREATED",clock.instant(),Target.membership(workspace.id(),member.id()),new Change(Field.ROLE,null,"ADMIN"));notices.adminAssigned(workspace.id(),member.id());return view(workspace);
        });
    }
    public List<WorkspaceView> list(Actor actor){return tx.execute(status->{identity.get().requireAuthenticatedForRead(actor);return store.workspaces(actor.userId()).stream().map(this::view).toList();});}
    public WorkspaceView get(Actor actor,long workspaceId){return tx.execute(status->{requireMemberForRead(actor,workspaceId);return view(store.workspaceForRead(workspaceId));});}
    /** Shared application policy: actor account and current membership are checked from DB, under the tenant lock. */
    public Membership requireMember(Actor actor,long workspaceId){
        identity.get().requireAuthenticated(actor);
        var workspace=store.workspace(workspaceId);if(workspace==null||!workspace.active())throw Errors.missing();
        var member=store.active(workspaceId,actor.userId());if(member==null)throw Errors.forbidden();return member;
    }
    /** Pure reads share account/tenant locks; mutations keep requireMember's exclusive locks. */
    public Membership requireMemberForRead(Actor actor,long workspaceId){
        identity.get().requireAuthenticatedForRead(actor);
        var workspace=store.workspaceForRead(workspaceId);if(workspace==null||!workspace.active())throw Errors.missing();
        var member=store.active(workspaceId,actor.userId());if(member==null)throw Errors.forbidden();return member;
    }
    private Membership requireAdmin(Actor actor,long workspaceId){var member=requireMember(actor,workspaceId);if(!member.admin())throw Errors.forbidden();return member;}
    private TerminationPreview terminationImpact(Actor actor,long workspaceId){
        var workspace=store.workspaceForRead(workspaceId);var members=store.members(workspaceId);
        var impacts=terminationParticipants.orderedStream().map(p->p.terminationImpact(workspaceId))
            .sorted(Comparator.comparing(WorkspaceTerminationParticipant.Impact::feature)).toList();
        var fingerprint=new StringBuilder("terminate:").append(actor.userId()).append(':').append(workspaceId).append(':').append(workspace.name().length()).append(':').append(workspace.name());
        for(var member:members)fingerprint.append(":member:").append(member.id()).append('@').append(member.role());
        for(var invitation:store.pendingInvitations(workspaceId))fingerprint.append(":invite:").append(invitation.id());
        for(var impact:impacts){fingerprint.append(':').append(impact.feature());for(var revision:impact.revisions())fingerprint.append(':').append(revision);}
        return new TerminationPreview(members.size(),impacts.stream().mapToInt(WorkspaceTerminationParticipant.Impact::documentCount).sum(),
            impacts.stream().anyMatch(WorkspaceTerminationParticipant.Impact::ongoingWork),"저장된 PDF·YouTube Playlist 명령의 RUNNING 상태. 동기 파일 요청 전체를 집계하는 값은 아닙니다.",TERMINATION_WARNINGS,fingerprint(fingerprint.toString()));
    }
    public TerminationPreview terminationPreview(Actor actor,long workspaceId){return tx.execute(status->{var member=requireMemberForRead(actor,workspaceId);if(!member.admin())throw Errors.forbidden();return terminationImpact(actor,workspaceId);});}
    public TerminationStatus terminate(Actor actor,long workspaceId,String workspaceName,String confirmation){
        if(workspaceName==null||confirmation==null||!confirmation.matches("[a-f0-9]{64}"))throw Errors.invalid("Workspace name and current confirmation required");
        return tx.execute(status->{
            requireAdmin(actor,workspaceId);var workspace=store.workspace(workspaceId);
            if(!workspace.name().equals(workspaceName))throw Errors.invalid("Workspace name does not match");
            if(!terminationImpact(actor,workspaceId).confirmation().equals(confirmation))throw Errors.conflict("Termination impact requires current confirmation");
            var now=clock.instant();workspace.terminate(now);
            for(var member:store.members(workspaceId)){
                member.end("WORKSPACE_TERMINATED");
                accounts.record(actor.userId(),"MEMBERSHIP_TERMINATED",now,Target.membership(workspaceId,member.id()),new Change(Field.STATE,"ACTIVE","ENDED"));
                notices.workspaceTerminated(workspaceId,member.id());
            }
            for(var invitation:store.pendingInvitations(workspaceId)){invitation.state("REVOKED");accounts.record(actor.userId(),"INVITATION_REVOKED",now,Target.invitation(workspaceId,invitation.id(),null),new Change(Field.STATE,"PENDING","REVOKED"));}
            accounts.record(actor.userId(),"WORKSPACE_TERMINATED",now,Target.workspace(workspaceId),new Change(Field.STATE,"ACTIVE","TERMINATED"));
            return new TerminationStatus(workspaceId,"TERMINATED",now);
        });
    }
    public TerminationStatus terminationStatus(Actor actor,long workspaceId){return tx.execute(status->{
        identity.get().requireAuthenticatedForRead(actor);var workspace=store.workspaceForRead(workspaceId);
        if(workspace==null||workspace.active()||!store.terminationRecipient(workspaceId,actor.userId()))throw Errors.missing();
        return new TerminationStatus(workspaceId,"TERMINATED",workspace.terminatedAt());
    });}
    public List<MemberView> members(Actor actor,long workspaceId){return tx.execute(status->{requireMemberForRead(actor,workspaceId);return store.memberData(workspaceId).stream().map(m->new MemberView(m.id(),m.userId(),m.displayName(),m.role(),m.state())).toList();});}
    public void transferAdmin(Actor actor,long workspaceId,long memberId){
        tx.executeWithoutResult(status->{
            var current=requireAdmin(actor,workspaceId);var target=activeTarget(workspaceId,memberId);
            if(current.id()==target.id()||!"MEMBER".equals(target.role()))throw Errors.conflict("ADMIN transfer requires another ACTIVE MEMBER");
            // Flush release before acquisition for the unique index. The transaction
            // prevents other capability requests from observing an intermediate gap.
            current.releaseAdmin();store.flush();target.promote();
            accounts.record(actor.userId(),"ADMIN_RELEASED",clock.instant(),Target.membership(workspaceId,current.id()),new Change(Field.ROLE,"ADMIN","MEMBER"));
            accounts.record(actor.userId(),"ADMIN_ASSIGNED",clock.instant(),Target.membership(workspaceId,target.id()),new Change(Field.ROLE,"MEMBER","ADMIN"));
            notices.adminAssigned(workspaceId,target.id());
        });
    }
    private Membership activeTarget(long workspaceId,long memberId){var member=store.membership(workspaceId,memberId);if(member==null||!member.active())throw Errors.missing();return member;}
    private List<MembershipLifecycle.RemovalResponsibility> removalResponsibilities(long workspaceId,long memberId){
        return lifecycles.orderedStream().flatMap(l->l.removalResponsibilities(workspaceId,memberId).stream())
            .sorted(Comparator.comparingLong(MembershipLifecycle.RemovalResponsibility::documentId)).toList();
    }
    private String removalConfirmation(long actor,long workspace,Membership target,List<MembershipLifecycle.RemovalResponsibility> affected){
        var value=new StringBuilder("remove:").append(actor).append(':').append(workspace).append(':').append(target.id()).append(':').append(target.userId()).append(':').append(target.role()).append(':').append(target.state());
        for(var item:affected)value.append(':').append(item.documentId()).append('@').append(item.version());
        // A current-state fingerprint, never an authorization credential.
        return fingerprint(value.toString());
    }
    private static String fingerprint(String value){
        // Impact is not a submitted login token: its size grows with real workspace data.
        try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    public RemovalPreview removalPreview(Actor actor,long workspaceId,long memberId){
        return tx.execute(status->{var current=requireMemberForRead(actor,workspaceId);if(!current.admin())throw Errors.forbidden();var target=activeTarget(workspaceId,memberId);if(target.admin())throw Errors.conflict("ADMIN removal is not supported");var affected=removalResponsibilities(workspaceId,memberId);return new RemovalPreview(memberId,affected.size(),removalConfirmation(actor.userId(),workspaceId,target,affected));});
    }
    public Responsibilities responsibilities(Actor actor,long workspaceId){
        return tx.execute(status->{var member=requireMemberForRead(actor,workspaceId);int sole=removalResponsibilities(workspaceId,member.id()).size();return new Responsibilities(member.admin(),sole,!member.admin()&&sole==0);});
    }
    public void remove(Actor actor,long workspaceId,long memberId){remove(actor,workspaceId,memberId,null);}
    public void remove(Actor actor,long workspaceId,long memberId,String confirmation){
        if(confirmation!=null&&!confirmation.matches("[a-f0-9]{64}"))throw Errors.invalid("Invalid removal confirmation");
        tx.executeWithoutResult(status->{
            var current=requireAdmin(actor,workspaceId);var target=activeTarget(workspaceId,memberId);if(target.admin())throw Errors.conflict("ADMIN removal is not supported");
            var affected=removalResponsibilities(workspaceId,memberId);
            if(confirmation==null&&!affected.isEmpty()||confirmation!=null&&!confirmation.equals(removalConfirmation(actor.userId(),workspaceId,target,affected)))
                throw Errors.conflict("Removal impact requires current confirmation");
            lifecycles.orderedStream().forEach(l->l.beforeRemoval(actor.userId(),workspaceId,memberId,current.id()));
            target.end("REMOVED");accounts.record(actor.userId(),"MEMBER_REMOVED",clock.instant(),Target.membership(workspaceId,memberId),new Change(Field.STATE,"ACTIVE","ENDED"));
        });
    }
    public void leave(Actor actor,long workspaceId){tx.executeWithoutResult(status->{var member=requireMember(actor,workspaceId);end(actor.userId(),member,"LEFT","WORKSPACE_LEFT");});}
    private void end(long actor,Membership member,String reason,String event){
        if(member.admin()&&store.members(member.workspaceId()).stream().filter(Membership::admin).count()==1)throw Errors.conflict("Last ADMIN must transfer responsibility");
        lifecycles.orderedStream().forEach(l->l.beforeEnd(member.workspaceId(),member.id()));member.end(reason);accounts.record(actor,event,clock.instant(),Target.membership(member.workspaceId(),member.id()),new Change(Field.STATE,"ACTIVE","ENDED"));
    }
    @Override public void beforeWithdraw(long userId){
        for(var workspace:store.workspaces(userId)){store.workspace(workspace.id());var member=store.active(workspace.id(),userId);if(member!=null)end(userId,member,"USER_WITHDRAWN","MEMBERSHIP_WITHDRAWN");}
    }
    private String rawToken(){byte[] bytes=new byte[32];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    private void commandKey(String key){if(key==null||key.isBlank()||key.length()>100)throw Errors.invalid("Command key required (max 100 characters)");}
    public InvitationView invite(Actor actor,long workspaceId,String email,String key){
        String normalized=IdentityService.canonical(email);commandKey(key);
        Send send=tx.execute(status->{
            requireAdmin(actor,workspaceId);var command=store.command(workspaceId,key);
            if(command!=null){var existing=store.invitation(workspaceId,command.invitationId());if(command.actorId()!=actor.userId()||!"INVITE".equals(command.operation())||!existing.email().equals(normalized))throw Errors.conflict("Command key reused for a different request");return null;}
            String raw=rawToken();var invitation=new Invitation(workspaceId,actor.userId(),normalized,IdentityService.hash(raw),clock.instant().plus(Duration.ofDays(7)));store.save(invitation);store.command(workspaceId,invitation.id(),actor.userId(),key,"INVITE");
            accounts.record(actor.userId(),"WORKSPACE_INVITED",clock.instant(),Target.invitation(workspaceId,invitation.id(),null),new Change(Field.STATE,null,"PENDING"));return new Send(workspaceId,invitation.id(),store.workspace(workspaceId).name(),normalized,raw);
        });
        if(send!=null)deliver(send);
        return tx.execute(status->{requireAdmin(actor,workspaceId);return view(store.invitation(workspaceId,store.command(workspaceId,key).invitationId()));});
    }
    public InvitationView resend(Actor actor,long workspaceId,long invitationId,String key){
        commandKey(key);
        Send send=tx.execute(status->{
            requireAdmin(actor,workspaceId);var invitation=store.invitation(workspaceId,invitationId);if(invitation==null)throw Errors.missing();
            var command=store.command(workspaceId,key);if(command!=null){if(command.actorId()!=actor.userId()||command.invitationId()!=invitationId||!"RESEND".equals(command.operation()))throw Errors.conflict("Command key reused");return null;}
            if(!"PENDING".equals(invitation.state())||invitation.expired(clock.instant()))throw Errors.conflict("Invitation is not pending");
            String raw=rawToken();invitation.rotate(IdentityService.hash(raw),clock.instant().plus(Duration.ofDays(7)));store.command(workspaceId,invitationId,actor.userId(),key,"RESEND");accounts.record(actor.userId(),"INVITATION_RESENT",clock.instant(),Target.invitation(workspaceId,invitationId,null),null);return new Send(workspaceId,invitationId,store.workspace(workspaceId).name(),invitation.email(),raw);
        });
        if(send!=null)deliver(send);return tx.execute(status->{requireAdmin(actor,workspaceId);return view(store.invitation(workspaceId,invitationId));});
    }
    private void deliver(Send send){
        String delivery="SENT";try{sender.sendInvitation(send.email(),send.name(),send.raw());}catch(RuntimeException failure){delivery="FAILED_RETRYABLE";}
        String result=delivery;tx.executeWithoutResult(status->{store.workspace(send.workspaceId());var invitation=store.invitation(send.workspaceId(),send.invitationId());if(invitation.matchesToken(IdentityService.hash(send.raw())))invitation.delivery(result);});
    }
    public void revoke(Actor actor,long workspaceId,long invitationId){tx.executeWithoutResult(status->{requireAdmin(actor,workspaceId);var invitation=store.invitation(workspaceId,invitationId);if(invitation==null)throw Errors.missing();if(!"PENDING".equals(invitation.state()))throw Errors.conflict("Invitation is not pending");invitation.state("REVOKED");accounts.record(actor.userId(),"INVITATION_REVOKED",clock.instant(),Target.invitation(workspaceId,invitationId,null),new Change(Field.STATE,"PENDING","REVOKED"));});}
    public MemberView accept(Actor actor,String raw){
        MemberView result=tx.execute(status->{
            var account=identity.get().getForChange(actor);var invitation=store.token(IdentityService.hash(raw));if(invitation==null)throw Errors.invalid("Invalid invitation");
            var workspace=store.workspace(invitation.workspaceId());if(workspace==null||!workspace.active())throw Errors.missing();store.refresh(invitation);
            if(!"PENDING".equals(invitation.state()))throw Errors.conflict("Invitation already ended");
            if(invitation.expired(clock.instant())){invitation.state("EXPIRED");return null;}
            if(account.emails().stream().noneMatch(e->e.verified()&&e.email().equals(invitation.email())))throw Errors.forbidden();
            if(store.active(invitation.workspaceId(),actor.userId())!=null)throw Errors.conflict("Already a workspace member");
            var member=new Membership(invitation.workspaceId(),actor.userId(),"MEMBER");store.save(member);invitation.state("ACCEPTED");accounts.record(actor.userId(),"INVITATION_ACCEPTED",clock.instant(),Target.invitation(invitation.workspaceId(),invitation.id(),member.id()),new Change(Field.STATE,"PENDING","ACCEPTED"));accounts.record(actor.userId(),"MEMBERSHIP_CREATED",clock.instant(),Target.membership(invitation.workspaceId(),member.id()),new Change(Field.ROLE,null,"MEMBER"));return view(member);
        });
        if(result==null)throw Errors.invalid("Invitation expired");return result;
    }
}
