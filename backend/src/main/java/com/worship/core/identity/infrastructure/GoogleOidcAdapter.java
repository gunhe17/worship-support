package com.worship.core.identity.infrastructure;
import java.io.IOException;
import jakarta.servlet.http.*;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.*;
import org.springframework.stereotype.Component;
@Component
public class GoogleOidcAdapter implements AuthorizationRequestRepository<OAuth2AuthorizationRequest>, AuthenticationSuccessHandler, AuthenticationFailureHandler {
    public static final String MODE = "google.pending.mode";
    private static final String VALIDATED_STATE = "google.validated.state";
    private final HttpSessionOAuth2AuthorizationRequestRepository delegate = new HttpSessionOAuth2AuthorizationRequestRepository();
    private final IdentityService identity;
    private final BrowserAuthentication browser;
    private final OidcIntentStore intents;
    public GoogleOidcAdapter(IdentityService identity, BrowserAuthentication browser, OidcIntentStore intents) { this.identity = identity; this.browser = browser; this.intents = intents; }
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) { return delegate.loadAuthorizationRequest(request); }
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorization, HttpServletRequest request, HttpServletResponse response) {
        if (authorization != null) {
            var prior = delegate.loadAuthorizationRequest(request);
            if (prior != null) intents.discard(prior.getState());
            String mode = (String) request.getSession().getAttribute(MODE);
            request.getSession().removeAttribute(MODE);
            Actor actor = null;
            if (mode != null) {
                actor = browser.actor(SecurityContextHolder.getContext().getAuthentication());
                if (!identity.valid(actor)) throw Errors.unauthenticated();
            }
            intents.create(authorization.getState(), mode == null ? "LOGIN" : mode, actor);
        }
        delegate.saveAuthorizationRequest(authorization, request, response);
    }
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        var authorization = delegate.removeAuthorizationRequest(request, response);
        if (authorization != null) request.setAttribute(VALIDATED_STATE, authorization.getState());
        return authorization;
    }
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        String state = (String) request.getAttribute(VALIDATED_STATE);
        try {
            if (state == null || !(authentication.getPrincipal() instanceof OidcUser google)) throw Errors.unauthenticated();
            var intent = intents.consume(state);
            String issuer = google.getIssuer().toString(), subject = google.getSubject();
            Actor actor = switch (intent.mode()) {
                case "LINK" -> identity.googleLink(intent.actor(), issuer, subject);
                case "REAUTHENTICATE" -> identity.googleReauthenticate(intent.actor(), issuer, subject);
                case "LOGIN" -> identity.googleLogin(issuer, subject, google.getEmail(), Boolean.TRUE.equals(google.getEmailVerified()));
                default -> throw Errors.invalid("Invalid OAuth mode");
            };
            browser.establish(actor, request, response); response.setStatus(204);
        } catch (RuntimeException failure) {
            browser.clear(request);
            response.setStatus(failure instanceof CapabilityException e ? e.status() : 409);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"GOOGLE_IDENTITY_REJECTED\",\"message\":\"Google identity could not be accepted\"}");
        }
    }
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException failure) throws IOException {
        intents.discard((String) request.getAttribute(VALIDATED_STATE));
        browser.clear(request); response.setStatus(401); response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"OIDC_AUTHENTICATION_FAILED\",\"message\":\"OIDC verification failed\"}");
    }
}
