package com.worship.core.identity.infrastructure;
import java.io.IOException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import com.worship.core.identity.application.IdentityService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
public class AccountSessionFilter extends OncePerRequestFilter {
    private final IdentityService identity;
    public AccountSessionFilter(IdentityService identity) { this.identity = identity; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AccountPrincipal principal && !identity.valid(principal.actor())) {
            SecurityContextHolder.clearContext();
            if (request.getSession(false) != null) request.getSession(false).invalidate();
        }
        chain.doFilter(request, response);
    }
}
