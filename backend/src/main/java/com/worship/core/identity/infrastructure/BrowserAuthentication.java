package com.worship.core.identity.infrastructure;
import java.util.List;
import jakarta.servlet.http.*;
import com.worship.core.shared.application.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.stereotype.Component;
@Component
public class BrowserAuthentication {
    private final HttpSessionSecurityContextRepository contexts = new HttpSessionSecurityContextRepository();
    public Actor actor(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof AccountPrincipal principal)) throw Errors.unauthenticated();
        return principal.actor();
    }
    public void establish(Actor actor, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) request.changeSessionId();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(new AccountPrincipal(actor), null, List.of()));
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        new HttpSessionCsrfTokenRepository().saveToken(null, request, response);
    }
    public void clear(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        if (request.getSession(false) != null) request.getSession(false).invalidate();
    }
}
