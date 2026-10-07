package com.worship.core.setlist.api;
import java.util.List;
import java.math.BigDecimal;
import com.worship.core.setlist.application.SetlistService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/workspaces/{workspaceId}/documents/{documentId}/setlist")
public class SetlistController {
    private final SetlistService setlists;private final BrowserAuthentication browser;
    public SetlistController(SetlistService setlists,BrowserAuthentication browser){this.setlists=setlists;this.browser=browser;}
    public record Update(@NotBlank String title,@NotNull String notes,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Song(@Positive long songId,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Order(@NotNull List<Long> itemIds,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Settings(String key,BigDecimal bpm,@NotNull List<String> sessions,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Notes(@NotNull String notes,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Form(@NotNull List<SetlistService.Block> blocks,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record ScoreSelection(@Positive Long scoreId,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record ReferenceSelection(@Positive Long referenceId,@NotNull @PositiveOrZero Long expectedVersion) {}
    @GetMapping public SetlistService.SetlistView get(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId){return setlists.get(browser.actor(auth),workspaceId,documentId);}
    @PutMapping public SetlistService.SetlistView update(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Update body){return setlists.update(browser.actor(auth),workspaceId,documentId,body.title(),body.notes(),body.expectedVersion());}
    @PostMapping("/items") public SetlistService.SetlistView add(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Song body){return setlists.add(browser.actor(auth),workspaceId,documentId,body.songId(),body.expectedVersion());}
    @DeleteMapping("/items/{itemId}") public SetlistService.SetlistView remove(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@RequestParam @PositiveOrZero long expectedVersion){return setlists.remove(browser.actor(auth),workspaceId,documentId,itemId,expectedVersion);}
    @PutMapping("/items/order") public SetlistService.SetlistView reorder(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Order body){return setlists.reorder(browser.actor(auth),workspaceId,documentId,body.itemIds(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/song") public SetlistService.SetlistView song(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody Song body){return setlists.selectSong(browser.actor(auth),workspaceId,documentId,itemId,body.songId(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/settings") public SetlistService.SetlistView settings(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody Settings body){return setlists.settings(browser.actor(auth),workspaceId,documentId,itemId,body.key(),body.bpm(),body.sessions(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/notes") public SetlistService.SetlistView notes(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody Notes body){return setlists.notes(browser.actor(auth),workspaceId,documentId,itemId,body.notes(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/song-form") public SetlistService.SetlistView form(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody Form body){return setlists.songForm(browser.actor(auth),workspaceId,documentId,itemId,body.blocks(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/score") public SetlistService.SetlistView score(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody ScoreSelection body){return setlists.selectScore(browser.actor(auth),workspaceId,documentId,itemId,body.scoreId(),body.expectedVersion());}
    @PutMapping("/items/{itemId}/reference") public SetlistService.SetlistView reference(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long itemId,@Valid @RequestBody ReferenceSelection body){return setlists.selectReference(browser.actor(auth),workspaceId,documentId,itemId,body.referenceId(),body.expectedVersion());}
}
