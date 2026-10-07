package com.worship.core.document.application;
import java.time.Clock;
import java.util.*;
import com.worship.core.document.domain.*;
import com.worship.core.document.infrastructure.DocumentStore;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.audit.application.AuditRecorder.*;
import com.worship.core.setlist.infrastructure.SetlistStore;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.application.*;
import com.worship.core.workspace.infrastructure.WorkspaceStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import static com.worship.core.document.application.DocumentAuthorizationPolicy.Action.*;
@Service
public class DocumentService implements MembershipLifecycle,WorkspaceTerminationParticipant {
    @Override public Impact terminationImpact(long workspaceId){var revisions=store.terminationRevisions(workspaceId);return new Impact("document",revisions.size(),false,revisions);}
    private final DocumentStore store;private final WorkspaceService workspace;private final WorkspaceStore memberships;
    private final DocumentAuthorizationPolicy policy;private final SetlistStore setlists;private final AuditRecorder audit;
    private final TransactionTemplate tx;private final Clock clock;
    private final MemberNoticeRecorder notices;
    public DocumentService(DocumentStore store,WorkspaceService workspace,WorkspaceStore memberships,DocumentAuthorizationPolicy policy,SetlistStore setlists,AuditRecorder audit,TransactionTemplate tx,Clock clock,MemberNoticeRecorder notices){this.store=store;this.workspace=workspace;this.memberships=memberships;this.policy=policy;this.setlists=setlists;this.audit=audit;this.tx=tx;this.clock=clock;this.notices=notices;}
    public record DocumentView(long id,long workspaceId,String title,String type,String accessPolicy,long version) {}
    public record GrantView(long membershipId,long userId,String displayName,String role) {}
    public List<GrantView> grants(Actor actor,long workspaceId,long documentId){return tx.execute(status->{policy.requireForRead(actor,workspaceId,documentId,MANAGE);return store.grantMembers(workspaceId,documentId).stream().map(g->new GrantView(g.membershipId(),g.userId(),g.displayName(),g.role())).toList();});}
    public DocumentAuthorizationPolicy.Permissions permissions(Actor actor,long workspaceId,long documentId){return tx.execute(status->policy.permissions(actor,workspaceId,documentId));}
    public DocumentView view(Document d){return new DocumentView(d.id(),d.workspaceId(),d.title(),d.type(),d.accessPolicy(),d.version());}
    private void access(String access){if(access==null||!Set.of("OPEN","RESTRICTED").contains(access))throw Errors.invalid("Invalid access policy");}
    public DocumentView create(Actor actor,long workspaceId,String title,String access){
        access(access);if(title==null||title.isBlank()||title.length()>200)throw Errors.invalid("Document title required");
        return tx.execute(status->{var member=workspace.requireMember(actor,workspaceId);var document=new Document(workspaceId,title.trim(),access,clock.instant());store.save(document);var grant=new DocumentGrant(workspaceId,document.id(),member.id(),"MANAGER");store.save(grant);setlists.createBlank(workspaceId,document.id());audit.record(actor.userId(),"DOCUMENT_CREATED",clock.instant(),Target.document(workspaceId,document.id()),new Change(Field.ACCESS_POLICY,null,access));audit.record(actor.userId(),"DOCUMENT_GRANT_CHANGED",clock.instant(),Target.grant(workspaceId,document.id(),member.id(),grant.id()),new Change(Field.ROLE,null,"MANAGER"));notices.managerAssigned(workspaceId,member.id(),document.id());return view(document);});
    }
    public List<DocumentView> list(Actor actor,long workspaceId){return tx.execute(status->{var member=workspace.requireMemberForRead(actor,workspaceId);return store.accessible(workspaceId,member.id()).stream().map(this::view).toList();});}
    public DocumentView get(Actor actor,long workspaceId,long documentId){return tx.execute(status->view(policy.requireRead(actor,workspaceId,documentId)));}
    public DocumentView changeAccess(Actor actor,long workspaceId,long documentId,String access,long expected){access(access);return tx.execute(status->{var document=policy.require(actor,workspaceId,documentId,MANAGE);policy.expectedVersion(document,expected);String before=document.accessPolicy();document.access(access);document.touch(clock.instant());store.flush();audit.record(actor.userId(),"DOCUMENT_ACCESS_CHANGED",clock.instant(),Target.document(workspaceId,documentId),new Change(Field.ACCESS_POLICY,before,access));return view(document);});}
    public DocumentView grant(Actor actor,long workspaceId,long documentId,long memberId,String role,long expected){
        if(role==null||!Set.of("MANAGER","EDITOR","VIEWER").contains(role))throw Errors.invalid("Invalid document role");
        return tx.execute(status->{var document=policy.require(actor,workspaceId,documentId,MANAGE);policy.expectedVersion(document,expected);var member=memberships.membership(workspaceId,memberId);if(member==null||!member.active())throw Errors.missing();var grant=store.grant(workspaceId,documentId,memberId);String before=grant==null?null:grant.role();if(grant!=null){preserveManager(workspaceId,documentId,grant,role);grant.role(role);}else{grant=new DocumentGrant(workspaceId,documentId,memberId,role);store.save(grant);}document.touch(clock.instant());store.flush();audit.record(actor.userId(),"DOCUMENT_GRANT_CHANGED",clock.instant(),Target.grant(workspaceId,documentId,memberId,grant.id()),new Change(Field.ROLE,before,role));if("MANAGER".equals(role)&&!"MANAGER".equals(before))notices.managerAssigned(workspaceId,memberId,documentId);return view(document);});
    }
    public DocumentView revoke(Actor actor,long workspaceId,long documentId,long memberId,long expected){return tx.execute(status->{var document=policy.require(actor,workspaceId,documentId,MANAGE);policy.expectedVersion(document,expected);var grant=store.grant(workspaceId,documentId,memberId);if(grant==null)throw Errors.missing();preserveManager(workspaceId,documentId,grant,null);String before=grant.role();long grantId=grant.id();store.delete(grant);document.touch(clock.instant());store.flush();audit.record(actor.userId(),"DOCUMENT_GRANT_REVOKED",clock.instant(),Target.grant(workspaceId,documentId,memberId,grantId),new Change(Field.ROLE,before,null));return view(document);});}
    private void preserveManager(long workspaceId,long documentId,DocumentGrant grant,String nextRole){if("MANAGER".equals(grant.role())&&!"MANAGER".equals(nextRole)&&store.managers(workspaceId,documentId)==1)throw Errors.conflict("Last MANAGER must transfer responsibility");}
    @Override public void beforeEnd(long workspaceId,long membershipId){for(var document:store.managed(workspaceId,membershipId))if(store.managers(workspaceId,document.id())==1)throw Errors.conflict("Sole MANAGER must transfer responsibility");}
    @Override public List<MembershipLifecycle.RemovalResponsibility> removalResponsibilities(long workspaceId,long membershipId){
        return store.solelyManaged(workspaceId,membershipId).stream()
            .map(d->new MembershipLifecycle.RemovalResponsibility(d.id(),d.version())).toList();
    }
    @Override public void beforeRemoval(long actorId,long workspaceId,long membershipId,long successorMembershipId){
        for(var responsibility:removalResponsibilities(workspaceId,membershipId)){
            var document=store.document(workspaceId,responsibility.documentId());
            var grant=store.grant(workspaceId,document.id(),successorMembershipId);String before=grant==null?null:grant.role();
            if(grant==null){grant=new DocumentGrant(workspaceId,document.id(),successorMembershipId,"MANAGER");store.save(grant);}else grant.role("MANAGER");
            document.touch(clock.instant());store.flush();
            audit.record(actorId,"DOCUMENT_MANAGER_INHERITED",clock.instant(),Target.grant(workspaceId,document.id(),successorMembershipId,grant.id()),new Change(Field.ROLE,before,"MANAGER"));
            notices.managerAssigned(workspaceId,successorMembershipId,document.id());
        }
    }
}
