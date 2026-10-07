package com.worship.core.song.application;
import java.util.List;
public interface SongCandidateSearch {
    record Candidate(String title,String artist,String source,String externalId,String referenceUrl) {}
    List<Candidate> search(String query);
}
