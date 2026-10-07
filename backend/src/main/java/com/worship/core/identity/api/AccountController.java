package com.worship.core.identity.api;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import com.worship.core.shared.application.Errors;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api")
public class AccountController {
    private final IdentityService identity;
    private final BrowserAuthentication browser;
    public AccountController(IdentityService identity, BrowserAuthentication browser) { this.identity = identity; this.browser = browser; }
    public record Credentials(@NotBlank @Size(max=254) String email, @NotBlank @Size(max=128) String password) {}
    public record EmailRequest(@NotBlank @Size(max=254) String email) {}
    public record SignupResend(@Positive long userId, @NotBlank String email) {}
    public record TokenRequest(@NotBlank @Size(max=512) String token) {}
    public record ResetRequest(@NotBlank @Size(max=512) String token, @NotBlank @Size(max=128) String password) {}
    public record PasswordRequest(@NotBlank @Size(max=128) String password) {}
    public record PasswordChange(@NotBlank @Size(max=128) String oldPassword, @NotBlank @Size(max=128) String newPassword) {}
    @PostMapping("/auth/signup") public IdentityService.DeliveryResult signup(@Valid @RequestBody Credentials body) { return identity.signup(body.email(), body.password()); }
    @PostMapping("/auth/verify-email") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void verify(@Valid @RequestBody TokenRequest body) { identity.verify(body.token()); }
    @PostMapping("/auth/resend-verification") @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public void resend(@Valid @RequestBody SignupResend body) { identity.resendVerification(body.userId(), body.email()); }
    @PostMapping("/auth/login") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void login(@Valid @RequestBody Credentials body, HttpServletRequest request, HttpServletResponse response) {
        browser.establish(identity.login(body.email(), body.password()), request, response);
    }
    @PostMapping("/auth/request-password-reset") @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public void requestReset(@Valid @RequestBody EmailRequest body) { identity.requestReset(body.email()); }
    @PostMapping("/auth/reset-password") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody ResetRequest body) { identity.reset(body.token(), body.password()); }
    @GetMapping("/account") public IdentityService.AccountView account(Authentication auth) { return identity.get(browser.actor(auth)); }
    @PostMapping("/account/reauthenticate") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void reauthenticate(Authentication auth, @Valid @RequestBody PasswordRequest body, HttpServletRequest request, HttpServletResponse response) {
        browser.establish(identity.reauthenticate(browser.actor(auth), body.password()), request, response);
    }
    @PostMapping("/account/emails") public IdentityService.DeliveryResult addEmail(Authentication auth, @Valid @RequestBody EmailRequest body) { return identity.addEmail(browser.actor(auth), body.email()); }
    @PostMapping("/account/emails/{emailId}/resend") public IdentityService.DeliveryResult resendEmail(Authentication auth, @PathVariable long emailId) { return identity.resendEmail(browser.actor(auth), emailId); }
    @PutMapping("/account/emails/{emailId}/primary") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void primary(Authentication auth, @PathVariable long emailId) { identity.setPrimary(browser.actor(auth), emailId); }
    @DeleteMapping("/account/emails/{emailId}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void removeEmail(Authentication auth, @PathVariable long emailId) { identity.removeEmail(browser.actor(auth), emailId); }
    @PostMapping("/account/password/change") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void changePassword(Authentication auth, @Valid @RequestBody PasswordChange body, HttpServletRequest request, HttpServletResponse response) {
        var actor = identity.changePassword(browser.actor(auth), body.oldPassword(), body.newPassword(), request.getSession().getId());
        browser.establish(actor, request, response);
    }
    @PutMapping("/account/password") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void setPassword(Authentication auth, @Valid @RequestBody PasswordRequest body) { identity.setPassword(browser.actor(auth), body.password()); }
    @DeleteMapping("/account/password") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void removePassword(Authentication auth) { identity.removePassword(browser.actor(auth)); }
    @DeleteMapping("/account/google/{identityId}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void unlink(Authentication auth, @PathVariable long identityId) { identity.unlinkGoogle(browser.actor(auth), identityId); }
    @DeleteMapping("/account") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void withdraw(Authentication auth, HttpServletRequest request) { identity.withdraw(browser.actor(auth)); browser.clear(request); }
}
