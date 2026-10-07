package com.worship.core.document.infrastructure;
import java.util.List;
import jakarta.persistence.*;
import com.worship.core.document.domain.*;
import org.springframework.stereotype.Repository;
@Repository
public class DocumentStore {
    @PersistenceContext private EntityManager em;
    public void save(Object entity){em.persist(entity);} public void delete(Object entity){em.remove(entity);} public void flush(){em.flush();}
    public List<String> terminationRevisions(long workspaceId){return em.createQuery("select d.id,d.version from Document d where d.workspaceId=:workspace order by d.id",Object[].class).setParameter("workspace",workspaceId).getResultList().stream().map(r->r[0]+"@"+r[1]).toList();}
    public record GrantMember(long membershipId,long userId,String displayName,String role) {}
    public List<GrantMember> grantMembers(long workspaceId,long documentId){
        return em.createQuery("select g.membershipId,m.userId,u.displayName,g.role from DocumentGrant g,Membership m,UserAccount u where g.workspaceId=:workspace and g.documentId=:document and m.workspaceId=:workspace and m.id=g.membershipId and m.state='ACTIVE' and u.id=m.userId order by m.id",Object[].class)
            .setParameter("workspace",workspaceId).setParameter("document",documentId).getResultList().stream()
            .map(r->new GrantMember(((Number)r[0]).longValue(),((Number)r[1]).longValue(),r[2]==null?"이름 미설정":(String)r[2],(String)r[3])).toList();
    }
    public List<Document> solelyManaged(long workspaceId,long memberId){
        return em.createQuery("select d from Document d,DocumentGrant g where d.workspaceId=:workspace and g.workspaceId=:workspace and g.documentId=d.id and g.membershipId=:member and g.role='MANAGER' and not exists(select other.id from DocumentGrant other,Membership m where other.workspaceId=:workspace and other.documentId=d.id and other.role='MANAGER' and other.membershipId<>:member and m.workspaceId=:workspace and m.id=other.membershipId and m.state='ACTIVE') order by d.id",Document.class)
            .setParameter("workspace",workspaceId).setParameter("member",memberId).getResultList();
    }
    public Document document(long workspaceId,long documentId){return em.createQuery("select d from Document d where d.workspaceId=:workspace and d.id=:document",Document.class).setParameter("workspace",workspaceId).setParameter("document",documentId).getResultStream().findFirst().orElse(null);}
    public DocumentGrant grant(long workspaceId,long documentId,long memberId){return em.createQuery("select g from DocumentGrant g where g.workspaceId=:workspace and g.documentId=:document and g.membershipId=:member",DocumentGrant.class).setParameter("workspace",workspaceId).setParameter("document",documentId).setParameter("member",memberId).getResultStream().findFirst().orElse(null);}
    public List<Document> accessible(long workspaceId,long memberId){return em.createQuery("select d from Document d where d.workspaceId=:workspace and (d.accessPolicy='OPEN' or exists(select g.id from DocumentGrant g where g.workspaceId=:workspace and g.documentId=d.id and g.membershipId=:member)) order by d.id",Document.class).setParameter("workspace",workspaceId).setParameter("member",memberId).getResultList();}
    public long managers(long workspaceId,long documentId){return em.createQuery("select count(g) from DocumentGrant g, Membership m where g.workspaceId=:workspace and g.documentId=:document and g.role='MANAGER' and g.membershipId=m.id and m.workspaceId=:workspace and m.state='ACTIVE'",Long.class).setParameter("workspace",workspaceId).setParameter("document",documentId).getSingleResult();}
    public List<Document> managed(long workspaceId,long memberId){return em.createQuery("select d from Document d, DocumentGrant g where d.workspaceId=:workspace and g.workspaceId=:workspace and g.documentId=d.id and g.membershipId=:member and g.role='MANAGER'",Document.class).setParameter("workspace",workspaceId).setParameter("member",memberId).getResultList();}
}
