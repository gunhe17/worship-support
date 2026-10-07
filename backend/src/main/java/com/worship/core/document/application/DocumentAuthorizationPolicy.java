package com.worship.core.document.application;
import com.worship.core.document.domain.Document;
import com.worship.core.document.infrastructure.DocumentStore;
import com.worship.core.workspace.application.WorkspaceService;
import com.worship.core.workspace.domain.Membership;
import com.worship.core.shared.application.*;
import org.springframework.stereotype.Component;
@Component
public class DocumentAuthorizationPolicy {
    public enum Action { READ,EDIT,MANAGE }
    public record Permissions(boolean canRead,boolean canEdit,boolean canManage,String effectiveRole) {}
    private final WorkspaceService workspace;
    private final DocumentStore store;
    public DocumentAuthorizationPolicy(WorkspaceService workspace,DocumentStore store){this.workspace=workspace;this.store=store;}
    public Document require(Actor actor,long workspaceId,long documentId,Action action){
        return authorize(workspace.requireMember(actor,workspaceId),workspaceId,documentId,action);
    }
    /** Explicit execution mode: READ permission inside a command still uses require's write guard. */
    public Document requireRead(Actor actor,long workspaceId,long documentId){
        return requireForRead(actor,workspaceId,documentId,Action.READ);
    }
    public Document requireForRead(Actor actor,long workspaceId,long documentId,Action action){return authorize(workspace.requireMemberForRead(actor,workspaceId),workspaceId,documentId,action);}
    private Document authorize(Membership member,long workspaceId,long documentId,Action action){
        var document=store.document(workspaceId,documentId);if(document==null)throw Errors.missing();
        // OPEN only skips the grant lookup for READ, never for EDIT or MANAGE.
        if(action==Action.READ&&"OPEN".equals(document.accessPolicy()))return document;
        var grant=store.grant(workspaceId,documentId,member.id());String role=grant==null?null:grant.role();
        if(!allowed(document.accessPolicy(),role,action))throw Errors.forbidden();return document;
    }
    private boolean allowed(String access,String role,Action action){return switch(action){case READ->"OPEN".equals(access)||role!=null;case EDIT->"MANAGER".equals(role)||"EDITOR".equals(role);case MANAGE->"MANAGER".equals(role);};}
    public Permissions permissions(Actor actor,long workspaceId,long documentId){
        var member=workspace.requireMemberForRead(actor,workspaceId);var document=store.document(workspaceId,documentId);if(document==null)throw Errors.missing();
        var grant=store.grant(workspaceId,documentId,member.id());String role=grant==null?null:grant.role();
        if(!allowed(document.accessPolicy(),role,Action.READ))throw Errors.forbidden();
        return new Permissions(true,allowed(document.accessPolicy(),role,Action.EDIT),allowed(document.accessPolicy(),role,Action.MANAGE),role);
    }
    public void expectedVersion(Document document,long expected){if(expected<0)throw Errors.invalid("Expected version required");if(document.version()!=expected)throw new CapabilityException(409,"VERSION_CONFLICT","Source has changed");}
}
