package com.worship.core;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import com.sun.net.httpserver.HttpServer;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.worship.core.identity.application.IdentityService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real Spring OIDC state/nonce/signature validation against an isolated local fake provider. */
@SpringBootTest @AutoConfigureMockMvc @Testcontainers
@Import({GoogleOidcIntegrationTest.Provider.class, IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class GoogleOidcIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",MYSQL::getJdbcUrl); p.add("spring.datasource.username",MYSQL::getUsername); p.add("spring.datasource.password",MYSQL::getPassword);
    }
    @TestConfiguration static class Provider {
        @Bean(destroyMethod="close") FakeGoogle fakeGoogle() throws Exception { return new FakeGoogle(); }
        @Bean ClientRegistrationRepository googleRegistrations(FakeGoogle google) {
            return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
                .clientId("test-client").clientSecret("test-secret").scope("openid","email")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .authorizationUri(google.url()+"/authorize").tokenUri(google.url()+"/token")
                .jwkSetUri(google.url()+"/jwks").issuerUri("https://accounts.google.com")
                .userNameAttributeName("sub").clientName("Fake Google").build());
        }
    }
    static class FakeGoogle implements AutoCloseable {
        final RSAKey key=new RSAKeyGenerator(2048).keyID("test-key").generate();
        final HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        final Map<String,String> tokens=new ConcurrentHashMap<>();
        FakeGoogle() throws Exception {
            server.createContext("/jwks",e -> {
                byte[] body=new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                e.getResponseHeaders().set("Content-Type","application/json"); e.sendResponseHeaders(200,body.length);
                try(var out=e.getResponseBody()){out.write(body);}
            });
            server.createContext("/token",e -> {
                var form=parse(new String(e.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
                String token=tokens.get(form.get("code"));
                byte[] body=("{\"access_token\":\"fake-access\",\"token_type\":\"Bearer\",\"expires_in\":300,\"id_token\":\""+token+"\"}").getBytes(StandardCharsets.UTF_8);
                e.getResponseHeaders().set("Content-Type","application/json"); e.sendResponseHeaders(200,body.length);
                try(var out=e.getResponseBody()){out.write(body);}
            });
            server.start();
        }
        String url(){return "http://127.0.0.1:"+server.getAddress().getPort();}
        String code(String nonce,String subject,String email) throws Exception {
            return code(nonce,subject,email,"https://accounts.google.com","test-client",Instant.now().plusSeconds(300),key);
        }
        String code(String nonce,String subject,String email,String issuer,String audience,Instant expires,RSAKey signingKey) throws Exception {
            var jwt=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
                new JWTClaimsSet.Builder().issuer(issuer).subject(subject).audience(audience)
                    .issueTime(Date.from(expires.minusSeconds(300))).expirationTime(Date.from(expires))
                    .claim("nonce",nonce).claim("email",email).claim("email_verified",true).build());
            jwt.sign(new RSASSASigner(signingKey)); String code=UUID.randomUUID().toString(); tokens.put(code,jwt.serialize()); return code;
        }
        public void close(){server.stop(0);}
    }
    static Map<String,String> parse(String query) {
        Map<String,String> values=new HashMap<>();
        for(String field:query.split("&")){String[] pair=field.split("=",2); values.put(URLDecoder.decode(pair[0],StandardCharsets.UTF_8),URLDecoder.decode(pair[1],StandardCharsets.UTF_8));}
        return values;
    }
    record Start(Cookie cookie,String state,String nonce) {}
    @Autowired MockMvc mvc;
    @Autowired FakeGoogle google;
    @Autowired IdentityService identity;
    @Autowired IdentityIntegrationTest.CapturingEmailSender mail;
    @Autowired JdbcTemplate jdbc;
    Start start(Cookie existing) throws Exception {
        var request=get("/oauth2/authorization/google"); if(existing!=null)request.cookie(existing);
        var response=mvc.perform(request).andExpect(status().is3xxRedirection()).andReturn().getResponse();
        var query=parse(URI.create(response.getRedirectedUrl()).getRawQuery());
        Cookie cookie=response.getCookie("SESSION"); return new Start(cookie==null?existing:cookie,query.get("state"),query.get("nonce"));
    }
    Cookie finish(Start start,String subject,String email) throws Exception {
        String code=google.code(start.nonce(),subject,email);
        return mvc.perform(get("/login/oauth2/code/google").cookie(start.cookie()).param("state",start.state()).param("code",code))
            .andExpect(status().isNoContent()).andReturn().getResponse().getCookie("SESSION");
    }
    @Test void validOidcCreatesGoogleOnlyAccountAndCallbackCannotReplay() throws Exception {
        String address=UUID.randomUUID()+"@example.org",subject=UUID.randomUUID().toString(); var start=start(null);
        assertThat(start.nonce()).isNotBlank(); Cookie cookie=finish(start,subject,address);
        mvc.perform(get("/api/account").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.passwordEnabled").value(false));
        mvc.perform(get("/login/oauth2/code/google").cookie(cookie).param("state",start.state()).param("code","replayed"))
            .andExpect(status().isUnauthorized());
    }
    @Test void invalidStateAndInvalidNonceDoNotCreateAccounts() throws Exception {
        int before=jdbc.queryForObject("SELECT COUNT(*) FROM user_account",Integer.class);
        var first=start(null);
        mvc.perform(get("/login/oauth2/code/google").cookie(first.cookie()).param("state","incorrect").param("code","unused"))
            .andExpect(status().isUnauthorized());
        var second=start(null); String code=google.code("incorrect-nonce",UUID.randomUUID().toString(),UUID.randomUUID()+"@example.org");
        mvc.perform(get("/login/oauth2/code/google").cookie(second.cookie()).param("state",second.state()).param("code",code))
            .andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_account",Integer.class)).isEqualTo(before);
    }
    @Test void existingEmailRequiresExplicitAuthenticatedLinkIntent() throws Exception {
        String address=UUID.randomUUID()+"@example.org",subject=UUID.randomUUID().toString();
        identity.signup(address,IdentityIntegrationTest.PASSWORD);identity.verify(mail.latest(address,false));
        var user=identity.login(address,IdentityIntegrationTest.PASSWORD);
        var login=start(null);String code=google.code(login.nonce(),subject,address);
        mvc.perform(get("/login/oauth2/code/google").cookie(login.cookie()).param("state",login.state()).param("code",code))
            .andExpect(status().isConflict());
        Cookie cookie=mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
            .content("{\"email\":\""+address+"\",\"password\":\""+IdentityIntegrationTest.PASSWORD+"\"}"))
            .andExpect(status().isNoContent()).andReturn().getResponse().getCookie("SESSION");
        mvc.perform(post("/api/account/google/link-intent").cookie(cookie).with(csrf())).andExpect(status().isOk());
        Cookie linked=finish(start(cookie),subject,address);
        mvc.perform(get("/api/account").cookie(linked)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(user.userId()));
        assertThat(identity.googleLogin("https://accounts.google.com",subject,address,true).userId()).isEqualTo(user.userId());
    }
    @Test void forgedSignatureWrongIssuerAudienceAndExpiredTokensHaveNoAccountOrIdentityEffects()throws Exception{
        int users=jdbc.queryForObject("SELECT COUNT(*) FROM user_account",Integer.class),identities=jdbc.queryForObject("SELECT COUNT(*) FROM external_identity",Integer.class);
        RSAKey forged=new RSAKeyGenerator(2048).keyID("test-key").generate();
        for(String invalid:List.of("signature","issuer","audience","expired")){
            var start=start(null);
            String code=google.code(start.nonce(),UUID.randomUUID().toString(),UUID.randomUUID()+"@example.org",
                invalid.equals("issuer")?"https://attacker.example":"https://accounts.google.com",
                invalid.equals("audience")?"other-client":"test-client",
                invalid.equals("expired")?Instant.now().minusSeconds(300):Instant.now().plusSeconds(300),invalid.equals("signature")?forged:google.key);
            mvc.perform(get("/login/oauth2/code/google").cookie(start.cookie()).param("state",start.state()).param("code",code)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/account").cookie(start.cookie())).andExpect(status().isUnauthorized());
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_account",Integer.class)).as(invalid).isEqualTo(users);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM external_identity",Integer.class)).as(invalid).isEqualTo(identities);
        }
    }
}
