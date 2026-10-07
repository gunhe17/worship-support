package com.worship.core.workspace.infrastructure;

import java.time.Instant;
import java.util.List;
import jakarta.persistence.*;
import org.springframework.stereotype.Repository;

/** Minimal in-app responsibility notices. No email, content copy or delivery queue. */
@Repository
public class MemberNoticeStore {
    @PersistenceContext private EntityManager em;
    public record Notice(long id,long workspaceId,Long documentId,String kind,Instant createdAt,Instant readAt) {}
    private static final String VISIBLE="""
        n.recipient_membership_id=m.id AND n.workspace_id=m.workspace_id AND m.user_id=:user
        AND (n.kind='WORKSPACE_TERMINATED' OR
            (m.state='ACTIVE' AND (n.kind='ADMIN_ASSIGNED' OR EXISTS(
                SELECT 1 FROM document d WHERE d.workspace_id=n.workspace_id AND d.id=n.document_id
                AND (d.access_policy='OPEN' OR EXISTS(SELECT 1 FROM document_grant g
                    WHERE g.workspace_id=n.workspace_id AND g.document_id=d.id AND g.membership_id=m.id))))))
        """;
    public void append(long workspace,long recipient,Long document,String kind,Instant now){
        em.flush();
        em.createNativeQuery("INSERT INTO member_notice(workspace_id,recipient_membership_id,document_id,kind,created_at) VALUES(:workspace,:recipient,:document,:kind,:now)")
            .setParameter("workspace",workspace).setParameter("recipient",recipient).setParameter("document",document)
            .setParameter("kind",kind).setParameter("now",now).executeUpdate();
    }
    @SuppressWarnings("unchecked")
    public List<Notice> list(long user,Long beforeId){
        var query=em.createNativeQuery("SELECT n.id,n.workspace_id,n.document_id,n.kind,n.created_at,n.read_at FROM member_notice n,workspace_membership m WHERE "+VISIBLE+(beforeId==null?"":" AND n.id<:before")+" ORDER BY n.id DESC",Object[].class).setParameter("user",user).setMaxResults(100);
        if(beforeId!=null)query.setParameter("before",beforeId);
        List<Object[]> rows=query.getResultList();
        return rows.stream().map(row->new Notice(((Number)row[0]).longValue(),((Number)row[1]).longValue(),row[2]==null?null:((Number)row[2]).longValue(),(String)row[3],instant(row[4]),instant(row[5]))).toList();
    }
    public boolean markRead(long user,long id,Instant now){
        var found=em.createNativeQuery("SELECT n.id FROM member_notice n,workspace_membership m WHERE "+VISIBLE+" AND n.id=:id",Long.class).setParameter("user",user).setParameter("id",id).getResultList();
        if(found.isEmpty())return false;
        em.createNativeQuery("UPDATE member_notice SET read_at=COALESCE(read_at,:now) WHERE id=:id").setParameter("id",id).setParameter("now",now).executeUpdate();
        return true;
    }
    private static Instant instant(Object value){
        if(value==null)return null;
        if(value instanceof java.sql.Timestamp timestamp)return timestamp.toInstant();
        if(value instanceof java.time.LocalDateTime time)return time.toInstant(java.time.ZoneOffset.UTC);
        throw new IllegalStateException("Unsupported notice timestamp representation");
    }
}
