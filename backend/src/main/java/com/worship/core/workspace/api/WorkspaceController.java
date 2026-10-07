package com.worship.core.workspace.api;
import java.util.List;
import com.worship.core.workspace.application.WorkspaceService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api")
public class WorkspaceController {
    private final WorkspaceService workspace;private final BrowserAuthentication browser;
    public WorkspaceController(WorkspaceService workspace,BrowserAuthentication browser){this.workspace=workspace;this.browser=browser;}
    public record Create(@NotBlank @Size(max=200) String name) {}
    public record Invite(@NotBlank @Size(max=254) String email,@NotBlank @Size(max=100) String commandKey) {}
    public record Command(@NotBlank @Size(max=100) String commandKey) {}
    public record Accept(@NotBlank @Size(max=512) String token) {}
    public record Terminate(@NotBlank @Size(max=200) String workspaceName,@NotBlank @Pattern(regexp="[a-f0-9]{64}") String confirmation) {}
    @GetMapping("/workspaces/{workspaceId}/termination-impact") public WorkspaceService.TerminationPreview terminationImpact(Authentication auth,@PathVariable long workspaceId){return workspace.terminationPreview(browser.actor(auth),workspaceId);}
    @PostMapping("/workspaces/{workspaceId}/terminate") public WorkspaceService.TerminationStatus terminate(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Terminate body){return workspace.terminate(browser.actor(auth),workspaceId,body.workspaceName(),body.confirmation());}
    @GetMapping("/account/workspaces/{workspaceId}/termination") public WorkspaceService.TerminationStatus terminationStatus(Authentication auth,@PathVariable long workspaceId){return workspace.terminationStatus(browser.actor(auth),workspaceId);}
    @PostMapping("/workspaces") public WorkspaceService.WorkspaceView create(Authentication auth,@Valid @RequestBody Create body){return workspace.create(browser.actor(auth),body.name());}
    @GetMapping("/workspaces") public List<WorkspaceService.WorkspaceView> list(Authentication auth){return workspace.list(browser.actor(auth));}
    @GetMapping("/workspaces/{workspaceId}") public WorkspaceService.WorkspaceView get(Authentication auth,@PathVariable long workspaceId){return workspace.get(browser.actor(auth),workspaceId);}
    @GetMapping("/workspaces/{workspaceId}/members") public List<WorkspaceService.MemberView> members(Authentication auth,@PathVariable long workspaceId){return workspace.members(browser.actor(auth),workspaceId);}
    @PostMapping("/workspaces/{workspaceId}/members/{memberId}/transfer-admin") public void transferAdmin(Authentication auth,@PathVariable long workspaceId,@PathVariable long memberId){workspace.transferAdmin(browser.actor(auth),workspaceId,memberId);}
    @GetMapping("/workspaces/{workspaceId}/members/{memberId}/removal-impact") public WorkspaceService.RemovalPreview removalImpact(Authentication auth,@PathVariable long workspaceId,@PathVariable long memberId){return workspace.removalPreview(browser.actor(auth),workspaceId,memberId);}
    @GetMapping("/workspaces/{workspaceId}/responsibilities") public WorkspaceService.Responsibilities responsibilities(Authentication auth,@PathVariable long workspaceId){return workspace.responsibilities(browser.actor(auth),workspaceId);}
    @DeleteMapping("/workspaces/{workspaceId}/members/{memberId}") public void remove(Authentication auth,@PathVariable long workspaceId,@PathVariable long memberId,@RequestParam(required=false) String confirmation){workspace.remove(browser.actor(auth),workspaceId,memberId,confirmation);}
    @PostMapping("/workspaces/{workspaceId}/leave") public void leave(Authentication auth,@PathVariable long workspaceId){workspace.leave(browser.actor(auth),workspaceId);}
    @PostMapping("/workspaces/{workspaceId}/invitations") public WorkspaceService.InvitationView invite(Authentication auth,@PathVariable long workspaceId,@Valid @RequestBody Invite body){return workspace.invite(browser.actor(auth),workspaceId,body.email(),body.commandKey());}
    @PostMapping("/workspaces/{workspaceId}/invitations/{invitationId}/resend") public WorkspaceService.InvitationView resend(Authentication auth,@PathVariable long workspaceId,@PathVariable long invitationId,@Valid @RequestBody Command body){return workspace.resend(browser.actor(auth),workspaceId,invitationId,body.commandKey());}
    @DeleteMapping("/workspaces/{workspaceId}/invitations/{invitationId}") public void revoke(Authentication auth,@PathVariable long workspaceId,@PathVariable long invitationId){workspace.revoke(browser.actor(auth),workspaceId,invitationId);}
    @PostMapping("/workspace-invitations/accept") public WorkspaceService.MemberView accept(Authentication auth,@Valid @RequestBody Accept body){return workspace.accept(browser.actor(auth),body.token());}
}
