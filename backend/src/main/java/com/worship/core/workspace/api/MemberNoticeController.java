package com.worship.core.workspace.api;

import java.util.List;
import com.worship.core.identity.infrastructure.BrowserAuthentication;
import com.worship.core.workspace.application.MemberNoticeService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/account/notices")
public class MemberNoticeController {
    private final MemberNoticeService notices;
    private final BrowserAuthentication browser;
    public MemberNoticeController(MemberNoticeService notices,BrowserAuthentication browser){this.notices=notices;this.browser=browser;}
    @GetMapping public List<MemberNoticeService.NoticeView> list(Authentication authentication,@RequestParam(required=false) Long beforeId){return notices.list(browser.actor(authentication),beforeId);}
    @PostMapping("/{noticeId}/read") public void read(Authentication authentication,@PathVariable long noticeId){notices.markRead(browser.actor(authentication),noticeId);}
}
