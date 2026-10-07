package com.worship.core.song.infrastructure;
import com.worship.core.song.application.SongCandidateSearch;
import com.worship.core.shared.application.CapabilityException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
@Configuration
public class SongSearchConfiguration {
    @Bean @ConditionalOnMissingBean(SongCandidateSearch.class)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="worship.youtube.enabled",havingValue="false",matchIfMissing=true)
    SongCandidateSearch unavailableSongSearch(){return query->{throw new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","Song search provider not configured");};}
}
