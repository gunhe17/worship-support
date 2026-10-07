package com.worship.core.setlist.infrastructure;
import jakarta.persistence.*;
import com.worship.core.setlist.domain.Setlist;
import com.worship.core.setlist.domain.SetlistItem;
import java.util.List;
import org.springframework.stereotype.Repository;
@Repository
public class SetlistStore {
    @PersistenceContext private EntityManager em;
    public void createBlank(long workspaceId,long documentId){em.persist(new Setlist(workspaceId,documentId));}
    public Setlist setlist(long workspaceId,long documentId){return em.createQuery("select s from Setlist s where s.workspaceId=:workspace and s.documentId=:document",Setlist.class).setParameter("workspace",workspaceId).setParameter("document",documentId).getResultStream().findFirst().orElse(null);}
    public List<SetlistItem> items(long workspaceId,long setlistId){return em.createQuery("select i from SetlistItem i where i.workspaceId=:workspace and i.setlistId=:setlist order by i.position",SetlistItem.class).setParameter("workspace",workspaceId).setParameter("setlist",setlistId).getResultList();}
    public SetlistItem item(long workspaceId,long setlistId,long itemId){return em.createQuery("select i from SetlistItem i where i.workspaceId=:workspace and i.setlistId=:setlist and i.id=:id",SetlistItem.class).setParameter("workspace",workspaceId).setParameter("setlist",setlistId).setParameter("id",itemId).getResultStream().findFirst().orElse(null);}
    public void save(SetlistItem item){em.persist(item);}public void delete(SetlistItem item){em.remove(item);}public void flush(){em.flush();}
}
