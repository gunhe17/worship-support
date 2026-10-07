package com.worship.core.identity.infrastructure;
import com.worship.core.identity.application.EmailSender;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
@Component @ConditionalOnProperty(name="worship.email.enabled", havingValue="true")
public class SmtpEmailSender implements EmailSender, com.worship.core.workspace.application.InvitationSender {
    private final JavaMailSender mail;
    private final String from;
    private final String browserUrl;
    public SmtpEmailSender(JavaMailSender mail, @Value("${worship.email.from}") String from, @Value("${worship.email.browser-url}") String browserUrl) {
        this.mail=mail; this.from=from; this.browserUrl=browserUrl;
    }
    public void sendVerification(String email, String token) { send(email,"Verify your email", "/verify-email?token="+token); }
    public void sendPasswordReset(String email, String token) { send(email,"Reset your password", "/reset-password?token="+token); }
    public void sendInvitation(String email,String workspaceName,String token) { send(email,"Workspace invitation: "+workspaceName,"/accept-invitation?token="+token); }
    private void send(String email,String subject,String path) {
        var message=new SimpleMailMessage();message.setFrom(from);message.setTo(email);message.setSubject(subject);message.setText(browserUrl+path);
        mail.send(message);
    }
}
