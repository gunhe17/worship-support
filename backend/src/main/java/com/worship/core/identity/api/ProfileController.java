package com.worship.core.identity.api;

import com.worship.core.identity.application.ProfileService;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/account/profile")
public class ProfileController {
    public record Update(@NotBlank @Size(max=80) String displayName) {}
    private final ProfileService profiles;
    private final BrowserAuthentication browser;
    public ProfileController(ProfileService profiles,BrowserAuthentication browser){this.profiles=profiles;this.browser=browser;}
    @GetMapping public ProfileService.ProfileView get(Authentication auth){return profiles.get(browser.actor(auth));}
    @PutMapping public ProfileService.ProfileView update(Authentication auth,@Valid @RequestBody Update body){return profiles.update(browser.actor(auth),body.displayName());}
}
