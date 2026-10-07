package com.worship.core.shared.infrastructure;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
@Configuration
public class RuntimeConfiguration {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean TransactionTemplate transactions(PlatformTransactionManager manager) { return new TransactionTemplate(manager); }
}
