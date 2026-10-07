package com.worship.core.integration.youtube;
import java.util.*;
public interface YouTubeProvider {
    String authorizationUrl(String state,String challenge);
    String exchange(String code,String verifier);
    String accessToken(String refresh);
    void revoke(String refresh);
    Optional<String> findPlaylist(String access,String marker);
    String createPlaylist(String access,String title,String marker);
    void synchronize(String access,String playlistId,List<String> videoIds);
    /** Revalidate the command before mutations; adapters with multiple requests must guard each write. */
    default void synchronize(String access,String playlistId,List<String> videoIds,Runnable beforeMutation){beforeMutation.run();synchronize(access,playlistId,videoIds);}
}
