package com.worship.core.integration.youtube;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.*;
import org.springframework.web.util.UriComponentsBuilder;
import com.worship.core.shared.application.CapabilityException;
@Component @ConditionalOnProperty(name="worship.youtube.enabled",havingValue="true")
public class YouTubeHttpAdapter implements YouTubeProvider,VideoSearch {
    public static final String SCOPE="https://www.googleapis.com/auth/youtube.force-ssl";
    private final RestClient http;private final String clientId,clientSecret,redirectUri,apiKey;
    @org.springframework.beans.factory.annotation.Autowired
    public YouTubeHttpAdapter(@Value("${worship.youtube.client-id}") String clientId,@Value("${worship.youtube.client-secret}") String clientSecret,@Value("${worship.youtube.redirect-uri}") String redirectUri,@Value("${worship.youtube.api-key:}") String apiKey){this(client(),clientId,clientSecret,redirectUri,apiKey);}
    /** Allows isolated HTTP contract tests to bind a fake request factory without network access. */
    YouTubeHttpAdapter(RestClient http,String clientId,String clientSecret,String redirectUri,String apiKey){this.http=http;this.clientId=clientId;this.clientSecret=clientSecret;this.redirectUri=redirectUri;this.apiKey=apiKey;}
    private static RestClient client(){
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());factory.setReadTimeout(Duration.ofSeconds(30));return RestClient.builder().requestFactory(factory).build();
    }
    public String authorizationUrl(String state,String challenge){return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth").queryParam("client_id",clientId).queryParam("redirect_uri",redirectUri).queryParam("response_type","code").queryParam("scope",SCOPE).queryParam("state",state).queryParam("access_type","offline").queryParam("prompt","consent").queryParam("code_challenge",challenge).queryParam("code_challenge_method","S256").build().encode().toUriString();}
    private Map<String,Object> token(Map<String,String> values){var form=new LinkedMultiValueMap<String,String>();values.forEach(form::add);form.add("client_id",clientId);form.add("client_secret",clientSecret);try{return map(http.post().uri("https://oauth2.googleapis.com/token").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(Map.class));}catch(RestClientException failure){throw new ProviderFailure(false);}}
    public String exchange(String code,String verifier){var response=token(Map.of("grant_type","authorization_code","code",code,"code_verifier",verifier,"redirect_uri",redirectUri));if(!Arrays.asList(string(response,"scope").split(" ")).contains(SCOPE))throw new ProviderFailure(false);return string(response,"refresh_token");}
    public String accessToken(String refresh){return string(token(Map.of("grant_type","refresh_token","refresh_token",refresh)),"access_token");}
    public void revoke(String refresh){var form=new LinkedMultiValueMap<String,String>();form.add("token",refresh);try{http.post().uri("https://oauth2.googleapis.com/revoke").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().toBodilessEntity();}catch(RestClientException failure){throw new ProviderFailure(false);}}
    private URI uri(String path,Map<String,String> query){var builder=UriComponentsBuilder.fromUriString("https://www.googleapis.com/youtube/v3/"+path);query.forEach(builder::queryParam);return builder.build().encode().toUri();}
    private Map<String,Object> request(HttpMethod method,URI uri,String access,Object body){try{var request=http.method(method).uri(uri);if(access!=null)request.headers(h->h.setBearerAuth(access));if(body!=null)request.contentType(MediaType.APPLICATION_JSON).body(body);var response=request.retrieve().body(Map.class);return response==null?Map.of():map(response);}catch(RestClientResponseException failure){throw new ProviderFailure(!failure.getStatusCode().is4xxClientError());}catch(RestClientException failure){throw new ProviderFailure(true);}}
    @SuppressWarnings("unchecked") private static Map<String,Object> map(Object value){if(!(value instanceof Map<?,?>))throw new ProviderFailure(true);return (Map<String,Object>)value;}
    private static String string(Map<String,Object> value,String key){Object item=value.get(key);if(!(item instanceof String s)||s.isBlank())throw new ProviderFailure(true);return s;}
    private static List<Map<String,Object>> items(Map<String,Object> response){Object value=response.get("items");if(!(value instanceof List<?> list))throw new ProviderFailure(false);return list.stream().map(YouTubeHttpAdapter::map).toList();}
    public List<Video> search(String query){if(apiKey.isBlank())throw new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","YouTube public search key not configured");var response=request(HttpMethod.GET,uri("search",Map.of("part","snippet","type","video","maxResults","25","q",query,"key",apiKey)),null,null);return items(response).stream().map(i->{var snippet=map(i.get("snippet"));return new Video(string(map(i.get("id")),"videoId"),string(snippet,"title"),string(snippet,"channelTitle"));}).toList();}
    public Optional<String> findPlaylist(String access,String marker){String page="";do{var response=request(HttpMethod.GET,uri("playlists",Map.of("part","snippet","mine","true","maxResults","50","pageToken",page)),access,null);for(var item:items(response))if(("Worship command "+marker).equals(map(item.get("snippet")).get("description")))return Optional.of(string(item,"id"));page=Objects.toString(response.get("nextPageToken"),"");}while(!page.isBlank());return Optional.empty();}
    public String createPlaylist(String access,String title,String marker){return string(request(HttpMethod.POST,uri("playlists",Map.of("part","snippet,status")),access,Map.of("snippet",Map.of("title",title,"description","Worship command "+marker),"status",Map.of("privacyStatus","private"))),"id");}
    public void synchronize(String access,String playlistId,List<String> videoIds){synchronize(access,playlistId,videoIds,()->{});}
    public void synchronize(String access,String playlistId,List<String> videoIds,Runnable beforeMutation){
        List<Map<String,Object>> existing=new ArrayList<>();String page="";do{var response=request(HttpMethod.GET,uri("playlistItems",Map.of("part","snippet","playlistId",playlistId,"maxResults","50","pageToken",page)),access,null);existing.addAll(items(response));page=Objects.toString(response.get("nextPageToken"),"");}while(!page.isBlank());
        existing.sort(Comparator.comparingInt(i->((Number)map(i.get("snippet")).get("position")).intValue()));var current=existing.stream().map(i->string(map(map(i.get("snippet")).get("resourceId")),"videoId")).toList();if(current.equals(videoIds))return;
        for(var item:existing){beforeMutation.run();request(HttpMethod.DELETE,uri("playlistItems",Map.of("id",string(item,"id"))),access,null);}
        for(int i=0;i<videoIds.size();i++){beforeMutation.run();request(HttpMethod.POST,uri("playlistItems",Map.of("part","snippet")),access,Map.of("snippet",Map.of("playlistId",playlistId,"position",i,"resourceId",Map.of("kind","youtube#video","videoId",videoIds.get(i)))));}
    }
}
