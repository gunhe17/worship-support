package com.worship.core.integration.youtube;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import com.worship.core.shared.application.CapabilityException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class CredentialCipher {
    private final byte[] key;private final SecureRandom random=new SecureRandom();
    public CredentialCipher(@Value("${worship.credentials.key:}") String encoded){key=encoded.isBlank()?null:Base64.getDecoder().decode(encoded);if(key!=null&&key.length!=32)throw new IllegalArgumentException("Credential key must have 32 bytes");}
    public void requireConfigured(){if(key==null)throw new CapabilityException(503,"CREDENTIAL_KEY_NOT_CONFIGURED","Credential encryption key is required");}
    public String encrypt(String value,String context){requireConfigured();try{byte[] iv=new byte[12];random.nextBytes(iv);var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));byte[] all=new byte[iv.length+encrypted.length];System.arraycopy(iv,0,all,0,iv.length);System.arraycopy(encrypted,0,all,iv.length,encrypted.length);return "v1:"+Base64.getEncoder().encodeToString(all);}catch(Exception failure){throw new IllegalStateException("Credential encryption failed");}}
    public String decrypt(String value,String context){requireConfigured();try{if(!value.startsWith("v1:"))throw new IllegalArgumentException();byte[] all=Base64.getDecoder().decode(value.substring(3));if(all.length<28)throw new IllegalArgumentException();var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,all,0,12));cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));return new String(cipher.doFinal(all,12,all.length-12),StandardCharsets.UTF_8);}catch(Exception failure){throw new IllegalStateException("Credential decryption failed");}}
}
