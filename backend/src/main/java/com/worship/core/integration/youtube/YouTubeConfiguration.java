package com.worship.core.integration.youtube;
import java.util.*;
import com.worship.core.shared.application.CapabilityException;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.context.annotation.*;
@Configuration
public class YouTubeConfiguration {
    @Bean @ConditionalOnMissingBean(YouTubeProvider.class)
    @ConditionalOnProperty(name="worship.youtube.enabled",havingValue="false",matchIfMissing=true)
    YouTubeProvider unavailableYouTube(){return new YouTubeProvider(){
        private RuntimeException fail(){return new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","YouTube provider not configured");}
        public String authorizationUrl(String s,String c){throw fail();}public String exchange(String c,String v){throw fail();}public String accessToken(String r){throw fail();}public void revoke(String r){throw fail();}public Optional<String> findPlaylist(String a,String m){throw fail();}public String createPlaylist(String a,String t,String m){throw fail();}public void synchronize(String a,String p,List<String> v){throw fail();}
    };}
}
