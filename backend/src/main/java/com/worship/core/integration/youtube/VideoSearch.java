package com.worship.core.integration.youtube;
import java.util.List;
public interface VideoSearch {
    record Video(String videoId,String title,String channel) {}
    List<Video> search(String query);
}
