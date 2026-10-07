package com.worship.core.identity.infrastructure;

import java.io.IOException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import com.worship.core.identity.application.IdentityService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

@Configuration
public class SecurityConfiguration {
    @Bean
    org.springframework.session.web.http.CookieSerializer sessionCookieSerializer() {
        var serializer = new org.springframework.session.web.http.DefaultCookieSerializer();
        serializer.setUseSecureCookie(true);
        serializer.setUseHttpOnlyCookie(true);
        serializer.setSameSite("Lax");
        serializer.setCookiePath("/");
        return serializer;
    }
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, IdentityService identity,
            ObjectProvider<ClientRegistrationRepository> registrations, GoogleOidcAdapter google) throws Exception {
        http
            .authorizeHttpRequests(a -> a.requestMatchers("/api/health", "/api/auth/csrf", "/api/auth/signup", "/api/auth/verify-email",
                "/api/auth/resend-verification", "/api/auth/login", "/api/auth/request-password-reset", "/api/auth/reset-password",
                "/oauth2/authorization/google", "/login/oauth2/code/google").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(new AccountSessionFilter(identity), AuthorizationFilter.class)
            .exceptionHandling(e -> e
                .authenticationEntryPoint((request, response, failure) -> error(response, 401, "AUTHENTICATION_REQUIRED"))
                .accessDeniedHandler((request, response, failure) -> error(response, 403, "ACCESS_DENIED")))
            .logout(l -> l.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, auth) -> response.setStatus(204)));
        if (registrations.getIfAvailable() != null) {
            http.oauth2Login(o -> o.authorizationEndpoint(a -> a.authorizationRequestRepository(google))
                .successHandler(google).failureHandler(google));
        }
        return http.build();
    }
    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }
    @Bean
    UserDetailsService noDefaultGeneratedAccount() {
        return username -> { throw new UsernameNotFoundException("Unknown account"); };
    }
    private static void error(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"Request rejected\"}");
    }
}
