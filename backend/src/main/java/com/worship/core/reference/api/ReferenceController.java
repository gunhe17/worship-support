package com.worship.core.reference.api;
import java.util.List;
import com.worship.core.reference.application.ReferenceService;
import com.worship.core.integration.youtube.VideoSearch;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/workspaces/{workspaceId}/references")
public class ReferenceController {
    private final ReferenceService references;private final BrowserAuthentication browser;
    public ReferenceController(ReferenceService references,BrowserAuthentication browser){this.references=references;this.browser=browser;}
    public record Direct(@NotBlank @Size(max=2048) String url,@Size(max=200) String title) {}
    public record Video(@NotBlank @Size(max=11) String videoId,@Size(max=200) String title) {}
    @PostMapping public ReferenceService.ReferenceView register(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Direct body){return references.register(browser.actor(auth),workspaceId,body.url(),body.title());}
    @PostMapping("/youtube") public ReferenceService.ReferenceView video(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Video body){return references.registerVideo(browser.actor(auth),workspaceId,body.videoId(),body.title());}
    @GetMapping public List<ReferenceService.ReferenceView> list(Authentication auth,@PathVariable long workspaceId){return references.list(browser.actor(auth),workspaceId);}
    @GetMapping("/youtube/candidates") public List<VideoSearch.Video> search(Authentication auth,@PathVariable long workspaceId,@RequestParam String query){return references.search(browser.actor(auth),workspaceId,query);}
}
