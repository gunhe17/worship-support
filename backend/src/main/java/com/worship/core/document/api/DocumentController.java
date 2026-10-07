package com.worship.core.document.api;
import java.util.List;
import com.worship.core.document.application.DocumentService;
import com.worship.core.document.application.DocumentAuthorizationPolicy;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/workspaces/{workspaceId}/documents")
public class DocumentController {
    private final DocumentService document;private final BrowserAuthentication browser;
    public DocumentController(DocumentService document,BrowserAuthentication browser){this.document=document;this.browser=browser;}
    public record Create(@NotBlank @Size(max=200) String title,@NotNull String accessPolicy) {}
    public record Access(@NotNull String accessPolicy,@NotNull @PositiveOrZero Long expectedVersion) {}
    public record Grant(@NotNull String role,@NotNull @PositiveOrZero Long expectedVersion) {}
    @PostMapping public DocumentService.DocumentView create(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Create body){return document.create(browser.actor(auth),workspaceId,body.title(),body.accessPolicy());}
    @GetMapping public List<DocumentService.DocumentView> list(Authentication auth,@PathVariable long workspaceId){return document.list(browser.actor(auth),workspaceId);}
    @GetMapping("/{documentId}") public DocumentService.DocumentView get(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId){return document.get(browser.actor(auth),workspaceId,documentId);}
    @GetMapping("/{documentId}/permissions") public DocumentAuthorizationPolicy.Permissions permissions(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId){return document.permissions(browser.actor(auth),workspaceId,documentId);}
    @GetMapping("/{documentId}/grants") public List<DocumentService.GrantView> grants(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId){return document.grants(browser.actor(auth),workspaceId,documentId);}
    @PutMapping("/{documentId}/access-policy") public DocumentService.DocumentView access(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@Valid @RequestBody Access body){return document.changeAccess(browser.actor(auth),workspaceId,documentId,body.accessPolicy(),body.expectedVersion());}
    @PutMapping("/{documentId}/grants/{membershipId}") public DocumentService.DocumentView grant(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long membershipId,@Valid @RequestBody Grant body){return document.grant(browser.actor(auth),workspaceId,documentId,membershipId,body.role(),body.expectedVersion());}
    @DeleteMapping("/{documentId}/grants/{membershipId}") public DocumentService.DocumentView revoke(Authentication auth,@PathVariable long workspaceId,@PathVariable long documentId,@PathVariable long membershipId,@RequestParam @PositiveOrZero long expectedVersion){return document.revoke(browser.actor(auth),workspaceId,documentId,membershipId,expectedVersion);}
}
