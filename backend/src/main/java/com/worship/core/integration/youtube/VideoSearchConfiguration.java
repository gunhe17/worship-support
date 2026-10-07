package com.worship.core.integration.youtube;
import com.worship.core.shared.application.CapabilityException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
@Configuration
public class VideoSearchConfiguration {
    @Bean @ConditionalOnMissingBean(VideoSearch.class)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="worship.youtube.enabled",havingValue="false",matchIfMissing=true)
    VideoSearch unavailableVideoSearch(){return query->{throw new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","YouTube search provider not configured");};}
}
