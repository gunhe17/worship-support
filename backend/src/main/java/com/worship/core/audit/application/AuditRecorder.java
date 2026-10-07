package com.worship.core.audit.application;

import java.time.Instant;
import java.util.Set;
import com.worship.core.audit.infrastructure.AuditStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Append-only security/responsibility facts in the same transaction as the capability. No content or credentials. */
@Service
public class AuditRecorder {
    public enum TargetType {USER,EMAIL,GOOGLE_IDENTITY,WORKSPACE,MEMBERSHIP,DOCUMENT,DOCUMENT_GRANT,INVITATION,YOUTUBE_AUTHORIZATION}
    public enum Field {ROLE,STATE,ACCESS_POLICY,CONNECTION,VERIFICATION,PRIMARY,PASSWORD_ENABLED}
    public record Target(TargetType type,long id,Long workspaceId,Long documentId,Long membershipId){
        public Target{
            if(type==null||id<=0||workspaceId!=null&&workspaceId<=0||documentId!=null&&documentId<=0||membershipId!=null&&membershipId<=0)throw new IllegalArgumentException("Invalid audit target IDs");
            boolean scoped=Set.of(TargetType.WORKSPACE,TargetType.MEMBERSHIP,TargetType.DOCUMENT,TargetType.DOCUMENT_GRANT,TargetType.INVITATION).contains(type);
            if(scoped!=(workspaceId!=null)||!scoped&&(documentId!=null||membershipId!=null))throw new IllegalArgumentException("Invalid audit tenant context");
            if(type==TargetType.WORKSPACE&&id!=workspaceId||type==TargetType.MEMBERSHIP&&(membershipId==null||id!=membershipId)||type==TargetType.DOCUMENT&&(documentId==null||id!=documentId)||type==TargetType.DOCUMENT_GRANT&&(documentId==null||membershipId==null))throw new IllegalArgumentException("Incomplete audit resource context");
        }
        public static Target account(TargetType type,long id){return new Target(type,id,null,null,null);}
        public static Target workspace(long id){return new Target(TargetType.WORKSPACE,id,id,null,null);}
        public static Target membership(long workspace,long id){return new Target(TargetType.MEMBERSHIP,id,workspace,null,id);}
        public static Target document(long workspace,long id){return new Target(TargetType.DOCUMENT,id,workspace,id,null);}
        public static Target grant(long workspace,long document,long member,long grant){return new Target(TargetType.DOCUMENT_GRANT,grant,workspace,document,member);}
        public static Target invitation(long workspace,long id,Long member){return new Target(TargetType.INVITATION,id,workspace,null,member);}
    }
    public record Change(Field field,String before,String after){
        public Change{
            if(field==null||before==null&&after==null)throw new IllegalArgumentException("Invalid audit change");
            Set<String> allowed=switch(field){
                case ROLE->Set.of("ADMIN","MEMBER","MANAGER","EDITOR","VIEWER");
                case STATE->Set.of("ACTIVE","TERMINATED","ENDED","WITHDRAWN","PENDING","ACCEPTED","REVOKED","EXPIRED");
                case ACCESS_POLICY->Set.of("OPEN","RESTRICTED");
                default->Set.of("TRUE","FALSE");
            };
            if(before!=null&&!allowed.contains(before)||after!=null&&!allowed.contains(after))throw new IllegalArgumentException("Only non-secret role/state values are allowed in audit changes");
        }
    }
    private final AuditStore store;
    public AuditRecorder(AuditStore store){this.store=store;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(long actor,String event,Instant now,Target target,Change change){
        if(actor<=0||event==null||!event.matches("[A-Z][A-Z_]{1,79}")||now==null||target==null)throw new IllegalArgumentException("Invalid audit event");
        store.append(actor,event,now,target,change);
    }
}
