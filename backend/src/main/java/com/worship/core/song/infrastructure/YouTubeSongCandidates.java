package com.worship.core.song.infrastructure;
import com.worship.core.song.application.SongCandidateSearch;
import com.worship.core.integration.youtube.VideoSearch;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import java.util.List;
@Component @ConditionalOnProperty(name="worship.youtube.enabled",havingValue="true")
public class YouTubeSongCandidates implements SongCandidateSearch {
    private final VideoSearch search;public YouTubeSongCandidates(VideoSearch search){this.search=search;}
    public List<Candidate> search(String query){return search.search(query).stream().map(v->new Candidate(v.title(),v.channel(),"YOUTUBE",v.videoId(),"https://www.youtube.com/watch?v="+v.videoId())).toList();}
}
