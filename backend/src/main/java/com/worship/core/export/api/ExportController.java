package com.worship.core.export.api;

import java.util.List;
import com.worship.core.export.application.ExportService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/workspaces/{workspaceId}/documents/{documentId}/exports")
public class ExportController {
    private final ExportService exports;private final BrowserAuthentication browser;
    public ExportController(ExportService exports,BrowserAuthentication browser){this.exports=exports;this.browser=browser;}
    public record Generate(@NotNull @PositiveOrZero Long sourceVersion,@NotBlank @Size(max=100) String commandKey) {}
    @PostMapping public ExportService.ExportView generate(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Generate body){return exports.generate(browser.actor(auth),workspaceId,documentId,body.sourceVersion(),body.commandKey());}
    @GetMapping public List<ExportService.ExportView> list(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId){return exports.list(browser.actor(auth),workspaceId,documentId);}
    @GetMapping("/{exportId}") public ExportService.ExportView get(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long exportId){return exports.get(browser.actor(auth),workspaceId,documentId,exportId);}
    @GetMapping("/{exportId}/download") public ResponseEntity<byte[]> download(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long exportId){var result=exports.download(browser.actor(auth),workspaceId,documentId,exportId);return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("setlist-"+documentId+"-v"+result.metadata().sourceVersion()+".pdf").build().toString()).body(result.bytes());}
}
