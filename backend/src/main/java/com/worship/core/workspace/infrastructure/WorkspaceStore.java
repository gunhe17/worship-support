package com.worship.core.workspace.infrastructure;
import java.util.*;
import jakarta.persistence.*;
import com.worship.core.workspace.domain.*;
import org.springframework.stereotype.Repository;
@Repository
public class WorkspaceStore {
    @PersistenceContext private EntityManager em;
    public void save(Object entity){em.persist(entity);}
    public void flush(){em.flush();}
    public record MemberData(long id,long userId,String displayName,String role,String state) {}
    public List<MemberData> memberData(long workspaceId){return memberData(workspaceId,null);}
    public List<MemberData> memberData(long workspaceId,Long membershipId){
        var query=em.createQuery("select m.id,m.userId,u.displayName,m.role,m.state from Membership m,UserAccount u where m.workspaceId=:workspace and m.state='ACTIVE' and u.id=m.userId"+(membershipId==null?"":" and m.id=:member")+" order by m.id",Object[].class).setParameter("workspace",workspaceId);
        if(membershipId!=null)query.setParameter("member",membershipId);
        return query.getResultList().stream()
            .map(r->new MemberData(((Number)r[0]).longValue(),((Number)r[1]).longValue(),r[2]==null?"이름 미설정":(String)r[2],(String)r[3],(String)r[4])).toList();
    }
    public Workspace workspace(long id){return em.find(Workspace.class,id,LockModeType.PESSIMISTIC_WRITE);}
    public Workspace workspaceForRead(long id){return em.find(Workspace.class,id,LockModeType.PESSIMISTIC_READ);}
    public List<Workspace> workspaces(long userId){return em.createQuery("select w from Workspace w, Membership m where w.id=m.workspaceId and w.state='ACTIVE' and m.userId=:user and m.state='ACTIVE' order by w.id",Workspace.class).setParameter("user",userId).getResultList();}
    public List<Invitation> pendingInvitations(long workspaceId){return em.createQuery("select i from Invitation i where i.workspaceId=:workspace and i.state='PENDING' order by i.id",Invitation.class).setParameter("workspace",workspaceId).getResultList();}
    public boolean terminationRecipient(long workspaceId,long userId){return !em.createNativeQuery("SELECT n.id FROM member_notice n JOIN workspace_membership m ON m.workspace_id=n.workspace_id AND m.id=n.recipient_membership_id WHERE n.workspace_id=:workspace AND m.user_id=:user AND n.kind='WORKSPACE_TERMINATED'",Long.class).setParameter("workspace",workspaceId).setParameter("user",userId).setMaxResults(1).getResultList().isEmpty();}
    public Membership active(long workspaceId,long userId){return em.createQuery("select m from Membership m where m.workspaceId=:workspace and m.activeUser=:user and m.state='ACTIVE'",Membership.class).setParameter("workspace",workspaceId).setParameter("user",userId).getResultStream().findFirst().orElse(null);}
    public Membership membership(long workspaceId,long id){return em.createQuery("select m from Membership m where m.workspaceId=:workspace and m.id=:id",Membership.class).setParameter("workspace",workspaceId).setParameter("id",id).getResultStream().findFirst().orElse(null);}
    public List<Membership> members(long workspaceId){return em.createQuery("select m from Membership m where m.workspaceId=:workspace and m.state='ACTIVE' order by m.id",Membership.class).setParameter("workspace",workspaceId).getResultList();}
    public Invitation invitation(long workspaceId,long id){return em.createQuery("select i from Invitation i where i.workspaceId=:workspace and i.id=:id",Invitation.class).setParameter("workspace",workspaceId).setParameter("id",id).getResultStream().findFirst().orElse(null);}
    public Invitation token(String hash){return em.createQuery("select i from Invitation i where i.tokenHash=:hash",Invitation.class).setParameter("hash",hash).getResultStream().findFirst().orElse(null);}
    public void refresh(Invitation i){em.refresh(i,LockModeType.PESSIMISTIC_WRITE);}
    public record Command(long invitationId,long actorId,String operation) {}
    public Command command(long workspaceId,String key){
        var rows=em.createNativeQuery("SELECT invitation_id,actor_id,operation FROM invitation_command WHERE workspace_id=:workspace AND command_key=:key",Object[].class).setParameter("workspace",workspaceId).setParameter("key",key).getResultList();
        if(rows.isEmpty())return null;Object[] row=(Object[])rows.getFirst();return new Command(((Number)row[0]).longValue(),((Number)row[1]).longValue(),(String)row[2]);
    }
    public void command(long workspaceId,long invitationId,long actorId,String key,String operation){em.createNativeQuery("INSERT INTO invitation_command(workspace_id,invitation_id,actor_id,command_key,operation) VALUES(:workspace,:invitation,:actor,:key,:operation)").setParameter("workspace",workspaceId).setParameter("invitation",invitationId).setParameter("actor",actorId).setParameter("key",key).setParameter("operation",operation).executeUpdate();}
}
