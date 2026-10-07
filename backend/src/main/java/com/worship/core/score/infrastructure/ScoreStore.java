package com.worship.core.score.infrastructure;
import java.time.Instant;
import java.util.List;
import jakarta.persistence.*;
import com.worship.core.score.domain.Score;
import org.springframework.stereotype.Repository;
@Repository
public class ScoreStore {
    @PersistenceContext private EntityManager em;
    public void save(Score score){em.persist(score);em.flush();}
    public Score score(long workspaceId,long scoreId){return em.createQuery("select s from Score s where s.workspaceId=:workspace and s.id=:score",Score.class).setParameter("workspace",workspaceId).setParameter("score",scoreId).getResultStream().findFirst().orElse(null);}
    public List<Score> list(long workspaceId){return em.createQuery("select s from Score s where s.workspaceId=:workspace order by s.id",Score.class).setParameter("workspace",workspaceId).getResultList();}
    public void cleanupFailed(long workspaceId,String key,Instant now){em.createNativeQuery("INSERT INTO storage_cleanup_failure(workspace_id,object_key,occurred_at) VALUES(:workspace,:key,:time)").setParameter("workspace",workspaceId).setParameter("key",key).setParameter("time",now).executeUpdate();}
}
