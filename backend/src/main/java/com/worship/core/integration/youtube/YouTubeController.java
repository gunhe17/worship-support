package com.worship.core.integration.youtube;
import java.util.Map;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api")
public class YouTubeController {
    private final YouTubeAuthorizationService authorization;private final PlaylistService playlists;private final BrowserAuthentication browser;
    public YouTubeController(YouTubeAuthorizationService authorization,PlaylistService playlists,BrowserAuthentication browser){this.authorization=authorization;this.playlists=playlists;this.browser=browser;}
    public record Command(String playlistId,@NotNull @PositiveOrZero Long sourceVersion,@NotBlank @Size(max=100) String commandKey) {}
    @GetMapping("/account/youtube") public Map<String,Boolean> state(Authentication auth){return Map.of("connected",authorization.connected(browser.actor(auth)));}
    @PostMapping("/account/youtube/connect") public Map<String,String> connect(Authentication auth){return Map.of("authorizationUrl",authorization.start(browser.actor(auth)));}
    /** OAuth redirect callback uses its single-use state/PKCE intent, rather than a browser mutation form. */
    @GetMapping("/account/youtube/callback") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void callback(Authentication auth,@RequestParam String state,@RequestParam String code){authorization.complete(browser.actor(auth),state,code);}
    @DeleteMapping("/account/youtube") public YouTubeAuthorizationService.DisconnectResult disconnect(Authentication auth){return authorization.disconnect(browser.actor(auth));}
    @PostMapping("/workspaces/{workspaceId}/documents/{documentId}/youtube-playlist") public PlaylistService.Result synchronize(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Command body){return playlists.synchronize(browser.actor(auth),workspaceId,documentId,body.playlistId(),body.sourceVersion(),body.commandKey());}
}
