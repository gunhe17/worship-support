package com.worship.core.song.infrastructure;
import java.util.List;
import jakarta.persistence.*;
import com.worship.core.song.domain.Song;
import org.springframework.stereotype.Repository;
@Repository
public class SongStore {
    @PersistenceContext private EntityManager em;
    public void save(Song song){em.persist(song);}
    public Song song(long workspaceId,long songId){return em.createQuery("select s from Song s where s.workspaceId=:workspace and s.id=:song",Song.class).setParameter("workspace",workspaceId).setParameter("song",songId).getResultStream().findFirst().orElse(null);}
    public List<Song> list(long workspaceId){return em.createQuery("select s from Song s where s.workspaceId=:workspace order by s.id",Song.class).setParameter("workspace",workspaceId).getResultList();}
}
