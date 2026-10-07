package com.worship.core.audit.infrastructure;

import java.time.Instant;
import jakarta.persistence.*;
import com.worship.core.audit.application.AuditRecorder.*;
import org.springframework.stereotype.Repository;

@Repository
public class AuditStore {
    @PersistenceContext private EntityManager em;
    public void append(long actor,String event,Instant now,Target target,Change change){
        // New JPA target rows must exist before the native, composite-FK-protected insert.
        em.flush();
        em.createNativeQuery("INSERT INTO audit_log(actor_id,event,occurred_at,workspace_id,document_id,membership_id,target_type,target_id,change_field,before_value,after_value) VALUES(:actor,:event,:time,:workspace,:document,:member,:type,:target,:field,:before,:after)")
            .setParameter("actor",actor).setParameter("event",event).setParameter("time",now)
            .setParameter("workspace",target.workspaceId()).setParameter("document",target.documentId()).setParameter("member",target.membershipId())
            .setParameter("type",target.type().name()).setParameter("target",target.id()).setParameter("field",change==null?null:change.field().name())
            .setParameter("before",change==null?null:change.before()).setParameter("after",change==null?null:change.after()).executeUpdate();
    }
}
