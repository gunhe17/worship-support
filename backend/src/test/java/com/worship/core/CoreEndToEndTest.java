package com.worship.core;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.util.*;
import jakarta.servlet.http.Cookie;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.text.PDFTextStripper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Full HTTP capability flow with real JDBC sessions and issued CSRF tokens, not mock authentication. */
@SpringBootTest(properties="worship.credentials.key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
@AutoConfigureMockMvc @Testcontainers
@Import({YouTubeIntegrationTest.Fakes.class,ScoreReferenceIntegrationTest.Fakes.class,WorkspaceIntegrationTest.Fakes.class,IdentityIntegrationTest.Fakes.class})
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class CoreEndToEndTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @Autowired MockMvc mvc;@Autowired IdentityIntegrationTest.CapturingEmailSender mail;
    @Autowired WorkspaceIntegrationTest.FakeInvitations invitations;@Autowired YouTubeIntegrationTest.FakeYouTube youtube;
    @Autowired @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping") org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping mappings;
    private final JsonMapper json=JsonMapper.builder().build();
    record Browser(String email,Cookie cookie,String header,String csrf) {}
    Browser csrf(String email,Cookie cookie)throws Exception{var request=get("/api/auth/csrf").secure(true);if(cookie!=null)request.cookie(cookie);var response=mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();var body=json.readTree(response.getContentAsByteArray());Cookie next=response.getCookie("SESSION");return new Browser(email,next==null?cookie:next,body.get("headerName").asText(),body.get("token").asText());}
    MockHttpServletRequestBuilder browser(MockHttpServletRequestBuilder request,Browser b){return request.secure(true).cookie(b.cookie()).header(b.header(),b.csrf());}
    JsonNode call(Browser b,HttpMethod method,String path,Map<String,?> body,int status)throws Exception{var request=browser(request(method,path),b);if(body!=null)request.contentType("application/json").content(json.writeValueAsBytes(body));var response=mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse();OpenApiContractTest.validateHttp(method.name(),path,status,response.getContentAsByteArray());return response.getContentAsByteArray().length==0?null:json.readTree(response.getContentAsByteArray());}
    Browser account()throws Exception{String address=UUID.randomUUID()+"@example.org";var anonymous=csrf(address,null);Map<String,String> credentials=Map.of("email",address,"password",IdentityIntegrationTest.PASSWORD);call(anonymous,HttpMethod.POST,"/api/auth/signup",credentials,200);call(anonymous,HttpMethod.POST,"/api/auth/verify-email",Map.of("token",mail.latest(address,false)),204);var response=mvc.perform(browser(post("/api/auth/login"),anonymous).contentType("application/json").content(json.writeValueAsBytes(credentials))).andExpect(status().isNoContent()).andReturn().getResponse();Cookie cookie=response.getCookie("SESSION");assertThat(cookie).isNotNull();assertThat(cookie.getSecure()).isTrue();assertThat(cookie.isHttpOnly()).isTrue();assertThat(cookie.getValue()).isNotEqualTo(anonymous.cookie().getValue());var signed=csrf(address,cookie);mvc.perform(post("/api/workspaces").secure(true).cookie(signed.cookie()).header(anonymous.header(),anonymous.csrf()).contentType("application/json").content("{\"name\":\"stale csrf\"}")).andExpect(status().isForbidden());return signed;}
    long join(Browser owner,String workspace,Browser member,String key)throws Exception{call(owner,HttpMethod.POST,workspace+"/invitations",Map.of("email",member.email(),"commandKey",key),200);return call(member,HttpMethod.POST,"/api/workspace-invitations/accept",Map.of("token",invitations.tokens.get(member.email())),200).get("id").asLong();}

    @Test void capabilityContractCoversHttpMappingsAndNeverReturnsJpaEntities()throws Exception{
        Map<?,?> contract;try(var resource=getClass().getResourceAsStream("/static/openapi.yaml")){contract=new org.yaml.snakeyaml.Yaml().load(resource);}Map<?,?> paths=(Map<?,?>)contract.get("paths");
        for(var entry:mappings.getHandlerMethods().entrySet()){
            if(!entry.getValue().getBeanType().getName().startsWith("com.worship.core."))continue;
            for(String path:entry.getKey().getPatternValues()){
                assertThat(paths.containsKey(path)).as("Contract path %s",path).isTrue();var operations=(Map<?,?>)paths.get(path);
                for(var method:entry.getKey().getMethodsCondition().getMethods())assertThat(operations.containsKey(method.name().toLowerCase(Locale.ROOT))).as("Contract %s %s",method,path).isTrue();
            }
            noEntity(entry.getValue().getMethod().getGenericReturnType(),new HashSet<>());
        }
        assertThat(java.security.Principal.class.isAssignableFrom(com.worship.core.shared.application.Actor.class)).isFalse();
        var exportPost=(Map<?,?>)((Map<?,?>)paths.get("/api/workspaces/{workspaceId}/documents/{documentId}/exports")).get("post");
        assertThat(exportPost.get("description").toString()).contains("EDIT","EDITOR","MANAGER");
        assertThat(((Map<?,?>)exportPost.get("responses")).containsKey("403")).isTrue();
        for(var method:com.worship.core.document.application.DocumentAuthorizationPolicy.class.getDeclaredMethods())for(var type:method.getParameterTypes())assertThat(type.getName()).doesNotStartWith("org.springframework.security");
    }
    void noEntity(java.lang.reflect.Type type,Set<java.lang.reflect.Type> seen){
        if(!seen.add(type))return;
        if(type instanceof java.lang.reflect.ParameterizedType p){noEntity(p.getRawType(),seen);for(var argument:p.getActualTypeArguments())noEntity(argument,seen);}
        if(type instanceof Class<?> c){assertThat(c.isAnnotationPresent(jakarta.persistence.Entity.class)).as("API entity %s",c.getName()).isFalse();if(c.isRecord())for(var component:c.getRecordComponents())noEntity(component.getGenericType(),seen);}
    }

    @Test void malformedRequestsAreRejectedWithoutServerErrorsOrMutation()throws Exception{
        Browser actor=account();
        mvc.perform(browser(post("/api/workspaces"),actor).contentType("application/json").content("{")).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/workspaces/999999/scores").secure(true).cookie(actor.cookie()).header(actor.header(),actor.csrf())).andExpect(status().isBadRequest());
        mvc.perform(browser(post("/api/workspaces"),actor).contentType("text/plain").content("text")).andExpect(status().isUnsupportedMediaType());
        mvc.perform(browser(patch("/api/workspaces"),actor)).andExpect(status().isMethodNotAllowed());
        mvc.perform(browser(get("/api/does-not-exist"),actor)).andExpect(status().isNotFound());
        assertThat(call(actor,HttpMethod.GET,"/api/workspaces",null,200).size()).isZero();
    }
    @Test void twoBrowserDraftConflictDoesNotOverwriteAndLaterPermissionLossIsNotVersionConflict()throws Exception{
        Browser a=account(),b=account();long w=call(a,HttpMethod.POST,"/api/workspaces",Map.of("name","Two editors"),200).get("id").asLong();String wp="/api/workspaces/"+w;long bm=join(a,wp,b,"two-editors");long d=call(a,HttpMethod.POST,wp+"/documents",Map.of("title","원본","accessPolicy","RESTRICTED"),200).get("id").asLong();String document=wp+"/documents/"+d,body=document+"/setlist";
        call(a,HttpMethod.PUT,document+"/grants/"+bm,Map.of("role","EDITOR","expectedVersion",0),200);var original=call(b,HttpMethod.GET,body,null,200);long v=original.get("version").asLong();
        call(a,HttpMethod.PUT,body,Map.of("title","A 저장본","notes","A 메모","expectedVersion",v),200);
        var draftB=Map.of("title","B의 미저장 초안","notes","B 메모","expectedVersion",v);var conflict=call(b,HttpMethod.PUT,body,draftB,409);assertThat(conflict.get("code").asText()).isEqualTo("VERSION_CONFLICT");
        var latest=call(b,HttpMethod.GET,body,null,200);assertThat(latest.get("title").asText()).isEqualTo("A 저장본");assertThat(latest.get("notes").asText()).isEqualTo("A 메모");assertThat(latest.get("version").asLong()).isEqualTo(v+1);
        // Explicit manual merge request, not silent version substitution/replay of the old draft.
        var merged=call(b,HttpMethod.PUT,body,Map.of("title","A 저장본","notes","A 메모 + B 메모","expectedVersion",v+1),200);assertThat(merged.get("version").asLong()).isEqualTo(v+2);
        call(a,HttpMethod.DELETE,document+"/grants/"+bm+"?expectedVersion="+(v+2),null,200);
        call(b,HttpMethod.GET,body,null,403);var denied=call(b,HttpMethod.PUT,body,draftB,403);assertThat(denied.get("code").asText()).isEqualTo("ACCESS_DENIED");
        var current=call(a,HttpMethod.GET,body,null,200);assertThat(current.get("notes").asText()).isEqualTo("A 메모 + B 메모");assertThat(current.get("version").asLong()).isEqualTo(v+3);
        call(b,HttpMethod.POST,"/api/auth/logout",null,204);call(b,HttpMethod.GET,body,null,401);
    }
    @Test void terminationHttpRequiresCsrfCurrentAdminNameAndImpactAndShowsOnlyOwnMinimalState()throws Exception{
        Browser admin=account(),member=account(),outsider=account();long w=call(admin,HttpMethod.POST,"/api/workspaces",Map.of("name","종료 HTTP"),200).get("id").asLong();String path="/api/workspaces/"+w;join(admin,path,member,"termination-member");
        call(member,HttpMethod.GET,path+"/termination-impact",null,403);var preview=call(admin,HttpMethod.GET,path+"/termination-impact",null,200);assertThat(preview.get("activeMemberCount").asInt()).isEqualTo(2);assertThat(preview.get("warnings").size()).isEqualTo(4);
        var body=Map.of("workspaceName","종료 HTTP","confirmation",preview.get("confirmation").asText());
        mvc.perform(post(path+"/terminate").secure(true).cookie(admin.cookie()).contentType("application/json").content(json.writeValueAsBytes(body))).andExpect(status().isForbidden());
        call(admin,HttpMethod.POST,path+"/terminate",Map.of("workspaceName","다른 이름","confirmation",body.get("confirmation")),400);call(member,HttpMethod.POST,path+"/terminate",body,403);
        var result=call(admin,HttpMethod.POST,path+"/terminate",body,200);assertThat(result.get("state").asText()).isEqualTo("TERMINATED");
        call(member,HttpMethod.GET,path,null,404);call(admin,HttpMethod.GET,path+"/members",null,404);assertThat(call(member,HttpMethod.GET,"/api/workspaces",null,200).size()).isZero();
        String own="/api/account/workspaces/"+w+"/termination";var minimal=call(member,HttpMethod.GET,own,null,200);assertThat(minimal.size()).isEqualTo(3);assertThat(minimal.has("name")).isFalse();call(outsider,HttpMethod.GET,own,null,404);call(member,HttpMethod.GET,"/api/account/workspaces/999999/termination",null,404);
        var notices=call(member,HttpMethod.GET,"/api/account/notices",null,200);assertThat(notices.size()).isEqualTo(1);assertThat(notices.get(0).get("kind").asText()).isEqualTo("WORKSPACE_TERMINATED");call(member,HttpMethod.POST,"/api/account/notices/"+notices.get(0).get("id").asLong()+"/read",null,200);
    }
    @Test void adminTransferAndOwnNoticeHttpContractRejectsLegacyPromotionAndOtherRecipients()throws Exception{
        Browser owner=account(),member=account(),outsider=account();
        long w=call(owner,HttpMethod.POST,"/api/workspaces",Map.of("name","Notice HTTP"),200).get("id").asLong();String path="/api/workspaces/"+w;
        long m=join(owner,path,member,"notice-http-join");
        mvc.perform(browser(post(path+"/members/"+m+"/promote"),owner)).andExpect(status().isNotFound());
        call(member,HttpMethod.POST,path+"/members/"+m+"/transfer-admin",null,403);
        call(owner,HttpMethod.POST,path+"/members/"+m+"/transfer-admin",null,200);
        var notices=call(member,HttpMethod.GET,"/api/account/notices",null,200);assertThat(notices.size()).isEqualTo(1);
        assertThat(notices.get(0).get("kind").asText()).isEqualTo("ADMIN_ASSIGNED");assertThat(notices.get(0).get("documentId").isNull()).isTrue();assertThat(notices.toString()).doesNotContain("email","Notice HTTP");
        long id=notices.get(0).get("id").asLong();
        assertThat(call(outsider,HttpMethod.GET,"/api/account/notices",null,200).size()).isZero();
        call(outsider,HttpMethod.POST,"/api/account/notices/"+id+"/read",null,404);
        mvc.perform(post("/api/account/notices/"+id+"/read").secure(true).cookie(member.cookie())).andExpect(status().isForbidden());
        call(member,HttpMethod.POST,"/api/account/notices/"+id+"/read",null,200);
        assertThat(call(member,HttpMethod.GET,"/api/account/notices",null,200).get(0).get("readAt").isNull()).isFalse();
        call(member,HttpMethod.GET,"/api/account/notices?beforeId=0",null,400);
        call(owner,HttpMethod.POST,path+"/invitations",Map.of("email","another@example.org","commandKey","old-admin-denied"),403);
    }

    @Test void profilePermissionViewsAndConfirmedRemovalHaveScopedHttpContracts()throws Exception{
        Browser owner=account(),member=account();call(owner,HttpMethod.PUT,"/api/account/profile",Map.of("displayName","민지"),200);call(member,HttpMethod.PUT,"/api/account/profile",Map.of("displayName","준호"),200);
        long w=call(owner,HttpMethod.POST,"/api/workspaces",Map.of("name","Profile and removal"),200).get("id").asLong();String workspace="/api/workspaces/"+w;long m=join(owner,workspace,member,"profile-member");
        var list=call(owner,HttpMethod.GET,workspace+"/members",null,200);assertThat(list.toString()).contains("민지","준호").doesNotContain("email");
        long d=call(member,HttpMethod.POST,workspace+"/documents",Map.of("title","restricted-title-forbidden-in-preview","accessPolicy","RESTRICTED"),200).get("id").asLong();String doc=workspace+"/documents/"+d;
        call(owner,HttpMethod.GET,doc+"/permissions",null,403);call(owner,HttpMethod.GET,doc+"/grants",null,403);call(member,HttpMethod.GET,doc+"/grants",null,200);
        assertThat(call(member,HttpMethod.GET,workspace+"/responsibilities",null,200).get("canLeave").asBoolean()).isFalse();call(member,HttpMethod.GET,workspace+"/members/"+m+"/removal-impact",null,403);
        var impact=call(owner,HttpMethod.GET,workspace+"/members/"+m+"/removal-impact",null,200);assertThat(impact.toString()).doesNotContain("restricted-title-forbidden-in-preview","documentId");assertThat(impact.get("affectedDocumentCount").asInt()).isEqualTo(1);
        call(owner,HttpMethod.DELETE,workspace+"/members/"+m,null,409);call(owner,HttpMethod.DELETE,workspace+"/members/"+m+"?confirmation="+impact.get("confirmation").asText(),null,200);
        assertThat(call(owner,HttpMethod.GET,doc+"/permissions",null,200).get("canManage").asBoolean()).isTrue();call(member,HttpMethod.GET,doc,null,403);
        call(member,HttpMethod.PUT,"/api/account/profile",Map.of("displayName"," "),400);assertThat(call(member,HttpMethod.GET,"/api/account/profile",null,200).get("displayName").asText()).isEqualTo("준호");
    }

    @Test void completeHttpPermissionMatrixIncludesExternalAndExportCapabilities()throws Exception{
        Browser owner=account(),admin=account(),member=account();long w=call(owner,HttpMethod.POST,"/api/workspaces",Map.of("name","Matrix"),200).get("id").asLong();String workspace="/api/workspaces/"+w;
        long adminId=join(owner,workspace,admin,"matrix-admin"),memberId=join(owner,workspace,member,"matrix-member");call(owner,HttpMethod.POST,workspace+"/members/"+adminId+"/transfer-admin",null,200);
        for(var actor:List.of(admin,member)){
            var connect=call(actor,HttpMethod.POST,"/api/account/youtube/connect",null,200);String state=URI.create(connect.get("authorizationUrl").asText()).getRawQuery().substring(6);mvc.perform(browser(get("/api/account/youtube/callback").param("state",state).param("code","matrix"),actor)).andExpect(status().isNoContent());
            long membership=actor==admin?adminId:memberId;
            for(String access:List.of("OPEN","RESTRICTED"))for(String role:List.of("NONE","VIEWER","EDITOR","MANAGER")){
                long d=call(owner,HttpMethod.POST,workspace+"/documents",Map.of("title",access+" "+role,"accessPolicy",access),200).get("id").asLong();String document=workspace+"/documents/"+d;long version=0;
                if(!role.equals("NONE")){call(owner,HttpMethod.PUT,document+"/grants/"+membership,Map.of("role",role,"expectedVersion",0),200);version++;}
                boolean read=access.equals("OPEN")||!role.equals("NONE"),edit=role.equals("EDITOR")||role.equals("MANAGER"),manage=role.equals("MANAGER");
                call(actor,HttpMethod.GET,document+"/setlist",null,read?200:403);call(actor,HttpMethod.PUT,document+"/setlist",Map.of("title","Matrix update","notes","","expectedVersion",version),edit?200:403);if(edit)version++;
                call(actor,HttpMethod.PUT,document+"/access-policy",Map.of("accessPolicy",access,"expectedVersion",version),manage?200:403);if(manage)version++;
                call(actor,HttpMethod.POST,document+"/youtube-playlist",Map.of("playlistId","PLmatrix","sourceVersion",version,"commandKey",UUID.randomUUID().toString()),edit?200:403);
                // PROJECT_DESIGN §§3.9/10: generation is EDIT; existing PDF download is READ.
                var command=Map.of("sourceVersion",version,"commandKey",UUID.randomUUID().toString());
                var export=call(actor,HttpMethod.POST,document+"/exports",command,edit?200:403);
                if(!edit)export=call(owner,HttpMethod.POST,document+"/exports",Map.of("sourceVersion",version,"commandKey",UUID.randomUUID().toString()),200);
                assertThat(export.get("status").asText()).isEqualTo("SUCCEEDED");
                mvc.perform(browser(get(document+"/exports/"+export.get("id").asLong()+"/download"),actor)).andExpect(status().is(read?200:403));
            }
        }
    }

    @Test void worshipPreparationExternalRetryImmutableExportAndResponsibilityTransfer()throws Exception{
        Browser owner=account(),editor=account(),viewer=account(),outsider=account();
        long w=call(owner,HttpMethod.POST,"/api/workspaces",Map.of("name","찬양팀"),200).get("id").asLong();String workspace="/api/workspaces/"+w;
        long editorId=join(owner,workspace,editor,"invite-editor"),viewerId=join(owner,workspace,viewer,"invite-viewer");
        long d=call(owner,HttpMethod.POST,workspace+"/documents",Map.of("title","주일 콘티","accessPolicy","RESTRICTED"),200).get("id").asLong();String document=workspace+"/documents/"+d,setlist=document+"/setlist";
        call(owner,HttpMethod.PUT,document+"/grants/"+editorId,Map.of("role","EDITOR","expectedVersion",0),200);call(owner,HttpMethod.PUT,document+"/grants/"+viewerId,Map.of("role","VIEWER","expectedVersion",1),200);
        long song=call(editor,HttpMethod.POST,workspace+"/songs",Map.of("title","주님의 은혜","artist","찬양팀"),200).get("id").asLong();
        byte[] scoreBytes;try(var pdf=new PDDocument();var out=new ByteArrayOutputStream()){pdf.addPage(new PDPage());pdf.save(out);scoreBytes=out.toByteArray();}
        var uploaded=mvc.perform(multipart(workspace+"/scores").file(new MockMultipartFile("file","score.pdf","application/pdf",scoreBytes)).param("songId",Long.toString(song)).secure(true).cookie(editor.cookie()).header(editor.header(),editor.csrf())).andExpect(status().isOk()).andReturn().getResponse();OpenApiContractTest.validateHttp("POST",workspace+"/scores",200,uploaded.getContentAsByteArray());long score=json.readTree(uploaded.getContentAsByteArray()).get("id").asLong();
        long reference=call(editor,HttpMethod.POST,workspace+"/references/youtube",Map.of("videoId","abcdefghijk","title","연습 영상"),200).get("id").asLong();
        var added=call(editor,HttpMethod.POST,setlist+"/items",Map.of("songId",song,"expectedVersion",2),200);long item=added.get("items").get(0).get("id").asLong();String itemPath=setlist+"/items/"+item;
        call(editor,HttpMethod.PUT,itemPath+"/settings",Map.of("key","D","bpm",72,"sessions",List.of("보컬","피아노"),"expectedVersion",3),200);
        call(editor,HttpMethod.PUT,itemPath+"/notes",Map.of("notes","조용하게 시작","expectedVersion",4),200);
        call(editor,HttpMethod.PUT,itemPath+"/song-form",Map.of("blocks",List.of(Map.of("id","verse","section","Verse","repeat",2,"cue","피아노만","calling","함께 찬양","note","크게")),"expectedVersion",5),200);
        call(editor,HttpMethod.PUT,itemPath+"/score",Map.of("scoreId",score,"expectedVersion",6),200);call(editor,HttpMethod.PUT,itemPath+"/reference",Map.of("referenceId",reference,"expectedVersion",7),200);
        assertThat(call(viewer,HttpMethod.GET,setlist,null,200).get("version").asLong()).isEqualTo(8);call(viewer,HttpMethod.PUT,itemPath+"/notes",Map.of("notes","Denied","expectedVersion",8),403);call(outsider,HttpMethod.GET,workspace+"/documents",null,403);
        var connect=call(editor,HttpMethod.POST,"/api/account/youtube/connect",null,200);String state=URI.create(connect.get("authorizationUrl").asText()).getRawQuery().substring(6);
        mvc.perform(browser(get("/api/account/youtube/callback").param("state",state).param("code","e2e"),editor)).andExpect(status().isNoContent());
        youtube.uncertainCreate=true;Map<String,Object> playlistCommand=Map.of("sourceVersion",8,"commandKey","e2e-playlist");assertThat(call(editor,HttpMethod.POST,document+"/youtube-playlist",playlistCommand,200).get("status").asText()).isEqualTo("UNCERTAIN");assertThat(call(editor,HttpMethod.POST,document+"/youtube-playlist",playlistCommand,200).get("status").asText()).isEqualTo("SUCCEEDED");assertThat(youtube.creates).isEqualTo(1);
        call(viewer,HttpMethod.POST,document+"/youtube-playlist",Map.of("sourceVersion",8,"commandKey","viewer-denied"),403);
        call(viewer,HttpMethod.POST,document+"/exports",Map.of("sourceVersion",8,"commandKey","viewer-export-denied"),403);
        var export=call(editor,HttpMethod.POST,document+"/exports",Map.of("sourceVersion",8,"commandKey","e2e-export"),200);assertThat(export.get("status").asText()).isEqualTo("SUCCEEDED");String download=document+"/exports/"+export.get("id").asLong()+"/download";
        byte[] bytes=mvc.perform(browser(get(download),viewer)).andExpect(status().isOk()).andExpect(content().contentType("application/pdf")).andReturn().getResponse().getContentAsByteArray();try(var pdf=Loader.loadPDF(bytes)){assertThat(new PDFTextStripper().getText(pdf)).contains("주님의 은혜","조용하게 시작","score.pdf");}
        call(editor,HttpMethod.PUT,setlist,Map.of("title","수정 콘티","notes","새 메모","expectedVersion",8),200);call(editor,HttpMethod.PUT,itemPath+"/notes",Map.of("notes","stale","expectedVersion",8),409);assertThat(mvc.perform(browser(get(download),viewer)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(bytes);
        call(owner,HttpMethod.DELETE,document+"/grants/"+viewerId+"?expectedVersion=9",null,200);call(viewer,HttpMethod.GET,download,null,403);call(outsider,HttpMethod.GET,download,null,403);
        long privateId=call(editor,HttpMethod.POST,workspace+"/documents",Map.of("title","비공개","accessPolicy","RESTRICTED"),200).get("id").asLong();String privateDoc=workspace+"/documents/"+privateId;
        call(owner,HttpMethod.GET,privateDoc,null,403);call(owner,HttpMethod.DELETE,workspace+"/members/"+editorId,null,409);call(owner,HttpMethod.POST,workspace+"/leave",null,409);
        long ownerId=call(owner,HttpMethod.GET,workspace+"/members",null,200).valueStream().filter(n->n.get("role").asText().equals("ADMIN")).findFirst().orElseThrow().get("id").asLong();
        call(editor,HttpMethod.PUT,privateDoc+"/grants/"+ownerId,Map.of("role","MANAGER","expectedVersion",0),200);call(owner,HttpMethod.DELETE,workspace+"/members/"+editorId,null,200);
        long rejoined=join(owner,workspace,editor,"rejoin-editor");assertThat(rejoined).isNotEqualTo(editorId);call(editor,HttpMethod.GET,setlist,null,403);call(editor,HttpMethod.GET,privateDoc,null,403);
        call(owner,HttpMethod.POST,workspace+"/members/"+viewerId+"/transfer-admin",null,200);call(owner,HttpMethod.PUT,document+"/grants/"+viewerId,Map.of("role","MANAGER","expectedVersion",10),200);call(owner,HttpMethod.PUT,privateDoc+"/grants/"+viewerId,Map.of("role","MANAGER","expectedVersion",1),200);
        call(owner,HttpMethod.DELETE,"/api/account",null,204);call(owner,HttpMethod.GET,"/api/account",null,401);mvc.perform(browser(get(download),viewer)).andExpect(status().isOk());
        call(editor,HttpMethod.DELETE,"/api/account",null,204);call(editor,HttpMethod.GET,"/api/account",null,401);
        assertThat(youtube.revokes).isZero();assertThat(call(outsider,HttpMethod.GET,"/api/workspaces",null,200).size()).isZero();
    }
}
