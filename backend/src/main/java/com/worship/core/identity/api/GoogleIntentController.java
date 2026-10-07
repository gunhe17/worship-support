package com.worship.core.identity.api;
import java.time.*;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.identity.infrastructure.*;
import com.worship.core.shared.application.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/account/google")
public class GoogleIntentController {
    private final IdentityService identity;
    private final BrowserAuthentication browser;
    private final Clock clock;
    private final ObjectProvider<ClientRegistrationRepository> registrations;
    public GoogleIntentController(IdentityService identity, BrowserAuthentication browser, Clock clock, ObjectProvider<ClientRegistrationRepository> registrations) {
        this.identity = identity; this.browser = browser; this.clock = clock; this.registrations = registrations;
    }
    @PostMapping("/link-intent")
    public Map<String,String> link(Authentication auth, HttpServletRequest request) {
        var actor = browser.actor(auth);
        if (actor.reauthenticatedAt().isBefore(clock.instant().minusSeconds(300))) throw new CapabilityException(403,"REAUTHENTICATION_REQUIRED","Recent reauthentication required");
        return start(auth, request, "LINK");
    }
    @PostMapping("/reauthentication-intent")
    public Map<String,String> reauthenticate(Authentication auth, HttpServletRequest request) { return start(auth, request, "REAUTHENTICATE"); }
    private Map<String,String> start(Authentication auth, HttpServletRequest request, String mode) {
        if (registrations.getIfAvailable() == null) throw new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","Google provider not configured");
        identity.get(browser.actor(auth)); request.getSession().setAttribute(GoogleOidcAdapter.MODE, mode);
        return Map.of("authorizationUrl", "/oauth2/authorization/google");
    }
}
