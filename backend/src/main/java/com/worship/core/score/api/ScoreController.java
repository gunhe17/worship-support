package com.worship.core.score.api;
import java.util.List;
import java.nio.charset.StandardCharsets;
import com.worship.core.score.application.ScoreService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController @RequestMapping("/api/workspaces/{workspaceId}/scores")
public class ScoreController {
    private final ScoreService scores;private final BrowserAuthentication browser;
    public ScoreController(ScoreService scores,BrowserAuthentication browser){this.scores=scores;this.browser=browser;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScoreService.ScoreView upload(Authentication auth,@PathVariable long workspaceId,@RequestParam(required=false) Long songId,@RequestPart MultipartFile file)throws java.io.IOException{return scores.upload(browser.actor(auth),workspaceId,songId,file.getOriginalFilename(),file.getContentType(),file.getBytes());}
    @GetMapping public List<ScoreService.ScoreView> list(Authentication auth,@PathVariable long workspaceId){return scores.list(browser.actor(auth),workspaceId);}
    @GetMapping("/{scoreId}/download") public ResponseEntity<byte[]> download(Authentication auth,@PathVariable long workspaceId,@PathVariable long scoreId){var download=scores.download(browser.actor(auth),workspaceId,scoreId);return ResponseEntity.ok().contentType(MediaType.parseMediaType(download.metadata().mediaType())).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(download.metadata().filename(),StandardCharsets.UTF_8).build().toString()).body(download.bytes());}
}
