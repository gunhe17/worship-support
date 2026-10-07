package com.worship.core.identity.infrastructure;
import com.worship.core.identity.application.EmailSender;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class UnavailableEmailSender {
    @Bean @ConditionalOnMissingBean(com.worship.core.workspace.application.InvitationSender.class)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="worship.email.enabled", havingValue="false", matchIfMissing=true)
    com.worship.core.workspace.application.InvitationSender invitationSender() {
        return (email,name,token)->{throw new IllegalStateException("Email provider not configured");};
    }
    @Bean @ConditionalOnMissingBean(EmailSender.class)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="worship.email.enabled", havingValue="false", matchIfMissing=true)
    EmailSender emailSender() {
        return new EmailSender() {
            public void sendVerification(String email, String token) { throw new IllegalStateException("Email provider not configured"); }
            public void sendPasswordReset(String email, String token) { throw new IllegalStateException("Email provider not configured"); }
        };
    }
}
