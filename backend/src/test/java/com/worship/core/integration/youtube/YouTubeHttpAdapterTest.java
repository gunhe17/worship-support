package com.worship.core.integration.youtube;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

/** Exercises real adapter HTTP contracts; every request is intercepted, no real Google side effects. */
class YouTubeHttpAdapterTest {
    final RestClient.Builder builder=RestClient.builder();
    final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
    final YouTubeHttpAdapter adapter=new YouTubeHttpAdapter(builder.build(),"client","secret","https://app.example/callback","api-key");
    static final String API="https://www.googleapis.com/youtube/v3/";
    static final String EXISTING="{\"items\":[{\"id\":\"first\",\"snippet\":{\"position\":0,\"resourceId\":{\"videoId\":\"abcdefghijk\"}}},{\"id\":\"second\",\"snippet\":{\"position\":1,\"resourceId\":{\"videoId\":\"lmnopqrstuv\"}}}]}";

    @Test void oauthUsesMinimalSeparateScopePkceAndFormCredentials(){
        String query=URLDecoder.decode(URI.create(adapter.authorizationUrl("state","challenge")).getRawQuery(),StandardCharsets.UTF_8);assertThat(query).contains("scope="+YouTubeHttpAdapter.SCOPE,"code_challenge=challenge","code_challenge_method=S256","access_type=offline").doesNotContain("openid");
        server.expect(requestTo("https://oauth2.googleapis.com/token")).andExpect(method(HttpMethod.POST)).andExpect(content().string(containsString("code_verifier=verifier"))).andExpect(content().string(containsString("client_secret=secret"))).andRespond(withSuccess("{\"refresh_token\":\"refresh\",\"scope\":\""+YouTubeHttpAdapter.SCOPE+"\"}",MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://oauth2.googleapis.com/token")).andExpect(content().string(containsString("refresh_token=refresh"))).andRespond(withSuccess("{\"access_token\":\"access\"}",MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://oauth2.googleapis.com/revoke")).andExpect(method(HttpMethod.POST)).andExpect(content().string("token=refresh")).andRespond(withSuccess());
        assertThat(adapter.exchange("code","verifier")).isEqualTo("refresh");assertThat(adapter.accessToken("refresh")).isEqualTo("access");adapter.revoke("refresh");server.verify();
    }
    @Test void candidateSearchAndMarkerReconciliationUseReadOnlyRequests(){
        server.expect(requestTo(startsWith(API+"search?"))).andExpect(method(HttpMethod.GET)).andExpect(queryParam("key","api-key")).andExpect(queryParam("type","video")).andRespond(withSuccess("{\"items\":[{\"id\":{\"videoId\":\"abcdefghijk\"},\"snippet\":{\"title\":\"Song\",\"channelTitle\":\"Channel\"}}]}",MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith(API+"playlists?"))).andExpect(queryParam("mine","true")).andExpect(header("Authorization","Bearer access")).andRespond(withSuccess("{\"items\":[],\"nextPageToken\":\"next\"}",MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith(API+"playlists?"))).andExpect(queryParam("pageToken","next")).andRespond(withSuccess("{\"items\":[{\"id\":\"PLfound\",\"snippet\":{\"description\":\"Worship command marker\"}}]}",MediaType.APPLICATION_JSON));
        assertThat(adapter.search("Song")).containsExactly(new VideoSearch.Video("abcdefghijk","Song","Channel"));assertThat(adapter.findPlaylist("access","marker")).contains("PLfound");server.verify();
    }
    @Test void synchronizationDeletesAndReinsertsExactOrderGuardingEveryMutation(){
        server.expect(requestTo(startsWith(API+"playlistItems?"))).andExpect(method(HttpMethod.GET)).andRespond(withSuccess(EXISTING,MediaType.APPLICATION_JSON));
        for(String id:List.of("first","second"))server.expect(requestTo(startsWith(API+"playlistItems?"))).andExpect(method(HttpMethod.DELETE)).andExpect(queryParam("id",id)).andRespond(withSuccess());
        for(int position=0;position<2;position++)server.expect(requestTo(startsWith(API+"playlistItems?"))).andExpect(method(HttpMethod.POST)).andExpect(content().string(containsString("\"position\":"+position))).andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
        var guard=new AtomicInteger();adapter.synchronize("access","PLtest",List.of("lmnopqrstuv","abcdefghijk"),guard::incrementAndGet);assertThat(guard.get()).isEqualTo(4);server.verify();
    }
    @Test void unchangedPlaylistDoesNotWriteAndRevokedAttemptStopsFollowingWrites(){
        server.expect(requestTo(startsWith(API+"playlistItems?"))).andRespond(withSuccess(EXISTING,MediaType.APPLICATION_JSON));var guard=new AtomicInteger();adapter.synchronize("access","PLtest",List.of("abcdefghijk","lmnopqrstuv"),guard::incrementAndGet);assertThat(guard.get()).isZero();server.verify();server.reset();
        server.expect(requestTo(startsWith(API+"playlistItems?"))).andExpect(method(HttpMethod.GET)).andRespond(withSuccess(EXISTING,MediaType.APPLICATION_JSON));server.expect(requestTo(startsWith(API+"playlistItems?"))).andExpect(method(HttpMethod.DELETE)).andExpect(queryParam("id","first")).andRespond(withSuccess());
        assertThatThrownBy(()->adapter.synchronize("access","PLtest",List.of(),()->{if(guard.incrementAndGet()==2)throw new IllegalStateException("revoked");})).isInstanceOf(IllegalStateException.class).hasMessage("revoked");assertThat(guard.get()).isEqualTo(2);server.verify();
    }
    @Test void createUsesPrivateMarkerAndSanitizesAmbiguousAndRejectedResponses(){
        for(var status:List.of(HttpStatus.INTERNAL_SERVER_ERROR,HttpStatus.FORBIDDEN)){
            server.expect(requestTo(startsWith(API+"playlists?"))).andExpect(method(HttpMethod.POST)).andExpect(content().string(containsString("\"privacyStatus\":\"private\""))).andExpect(content().string(containsString("Worship command marker"))).andRespond(withStatus(status).body("secret-provider-response"));
            var failure=catchThrowable(()->adapter.createPlaylist("access","Sunday","marker"));assertThat(failure).isInstanceOf(ProviderFailure.class);assertThat(((ProviderFailure)failure).uncertain()).isEqualTo(status.is5xxServerError());assertThat(failure.getMessage()).doesNotContain("secret-provider-response");server.verify();server.reset();
        }
    }
}
