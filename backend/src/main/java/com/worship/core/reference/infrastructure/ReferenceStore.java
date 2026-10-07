package com.worship.core.reference.infrastructure;
import java.util.List;
import jakarta.persistence.*;
import com.worship.core.reference.domain.Reference;
import org.springframework.stereotype.Repository;
@Repository
public class ReferenceStore {
    @PersistenceContext private EntityManager em;
    public void save(Reference reference){em.persist(reference);}
    public Reference reference(long workspaceId,long referenceId){return em.createQuery("select r from Reference r where r.workspaceId=:workspace and r.id=:id",Reference.class).setParameter("workspace",workspaceId).setParameter("id",referenceId).getResultStream().findFirst().orElse(null);}
    public List<Reference> list(long workspaceId){return em.createQuery("select r from Reference r where r.workspaceId=:workspace order by r.id",Reference.class).setParameter("workspace",workspaceId).getResultList();}
}
