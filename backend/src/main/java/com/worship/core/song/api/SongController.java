package com.worship.core.song.api;
import java.util.List;
import com.worship.core.song.application.*;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/workspaces/{workspaceId}/songs")
public class SongController {
    private final SongService songs;private final BrowserAuthentication browser;
    public SongController(SongService songs,BrowserAuthentication browser){this.songs=songs;this.browser=browser;}
    public record Register(@NotBlank @Size(max=200) String title,@Size(max=200) String artist) {}
    @PostMapping public SongService.SongView register(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Register body){return songs.register(browser.actor(auth),workspaceId,body.title(),body.artist());}
    @GetMapping public List<SongService.SongView> list(Authentication auth,@PathVariable long workspaceId){return songs.list(browser.actor(auth),workspaceId);}
    @GetMapping("/candidates") public List<SongCandidateSearch.Candidate> search(Authentication auth,@PathVariable long workspaceId,@RequestParam String query){return songs.search(browser.actor(auth),workspaceId,query);}
}
