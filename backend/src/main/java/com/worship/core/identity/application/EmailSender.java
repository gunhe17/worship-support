package com.worship.core.identity.application;
public interface EmailSender {
    void sendVerification(String email, String token);
    void sendPasswordReset(String email, String token);
}
