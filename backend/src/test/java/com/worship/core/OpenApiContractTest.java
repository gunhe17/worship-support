package com.worship.core;

import java.lang.reflect.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import jakarta.validation.constraints.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;

/** Static, reviewed contract. Tests emit only a build candidate, never rewrite the shipped contract. */
class OpenApiContractTest {
    static final Path CONTRACT=Path.of("src/main/resources/static/openapi.yaml");
    static final JsonMapper JSON=JsonMapper.builder().build();
    static final List<Class<?>> CONTROLLERS=List.of(
        com.worship.core.identity.api.AccountController.class,com.worship.core.identity.api.SessionController.class,
        com.worship.core.identity.api.GoogleIntentController.class,com.worship.core.workspace.api.WorkspaceController.class,
        com.worship.core.workspace.api.MemberNoticeController.class,
        com.worship.core.identity.api.ProfileController.class,
        com.worship.core.document.api.DocumentController.class,com.worship.core.setlist.api.SetlistController.class,
        com.worship.core.song.api.SongController.class,com.worship.core.score.api.ScoreController.class,
        com.worship.core.reference.api.ReferenceController.class,com.worship.core.integration.youtube.YouTubeController.class,
        com.worship.core.export.api.ExportController.class);
    @SuppressWarnings("unchecked") static Map<String,Object> map(Object value){return (Map<String,Object>)value;}
    static Map<String,Object> read()throws Exception{return map(new org.yaml.snakeyaml.Yaml().load(Files.readString(CONTRACT)));}
    final Map<String,Object> schemas=new TreeMap<>();
    static Map<String,Object> object(Object... entries){Map<String,Object> result=new LinkedHashMap<>();for(int i=0;i<entries.length;i+=2)result.put((String)entries[i],entries[i+1]);return result;}
    static boolean required(AnnotatedElement field,Class<?> type){return type.isPrimitive()||field.isAnnotationPresent(NotNull.class)||field.isAnnotationPresent(NotBlank.class)||field.isAnnotationPresent(NotEmpty.class);}
    Map<String,Object> nullable(Map<String,Object> schema,boolean nullable){return nullable?object("anyOf",List.of(schema,object("type","null"))):schema;}
    Map<String,Object> schema(Type type,boolean request){
        if(type instanceof ParameterizedType p){
            if(p.getRawType()==org.springframework.http.ResponseEntity.class)return schema(p.getActualTypeArguments()[0],request);
            if(p.getRawType()==List.class)return object("type","array","items",schema(p.getActualTypeArguments()[0],request));
            if(p.getRawType()==Map.class)return object("type","object","additionalProperties",schema(p.getActualTypeArguments()[1],request));
            throw new AssertionError("Unhandled API type "+type);
        }
        Class<?> c=(Class<?>)type;
        if(c==String.class)return object("type","string");
        if(c==Instant.class)return object("type","string","format","date-time");
        if(c==long.class||c==Long.class||c==int.class||c==Integer.class)return object("type","integer","format",c==int.class||c==Integer.class?"int32":"int64");
        if(c==boolean.class||c==Boolean.class)return object("type","boolean");
        if(c==java.math.BigDecimal.class)return object("type","number");
        if(c==byte[].class||c==org.springframework.web.multipart.MultipartFile.class)return object("type","string","format","binary");
        assertThat(c.isAnnotationPresent(jakarta.persistence.Entity.class)).isFalse();assertThat(c.isRecord()).as("Explicit DTO schema for %s",c).isTrue();
        String name=(c.getEnclosingClass()==null?"":c.getEnclosingClass().getSimpleName())+c.getSimpleName()+(request?"Request":"Response");
        if(!schemas.containsKey(name)){
            Map<String,Object> properties=new LinkedHashMap<>();List<String> fields=new ArrayList<>();
            schemas.put(name,object("type","object","properties",properties,"required",fields));
            for(var field:c.getRecordComponents()){
                var accessor=field.getAccessor();boolean required=required(accessor,field.getType());
                Map<String,Object> value=schema(field.getGenericType(),request);constraints(value,accessor);
                properties.put(field.getName(),nullable(value,request?!required:responseNullable(c,field.getName())));
                if(!request||required)fields.add(field.getName());
            }
            businessConstraints(c,properties,fields,request);
        }
        return object("$ref","#/components/schemas/"+name);
    }
    static boolean responseNullable(Class<?> type,String field){
        String name=(type.getEnclosingClass()==null?"":type.getEnclosingClass().getSimpleName())+type.getSimpleName();
        return switch(name){
            case "SongServiceSongView"->field.equals("artist");
            case "SongCandidateSearchCandidate"->Set.of("artist","externalId","referenceUrl").contains(field);
            case "ScoreServiceScoreView"->field.equals("songId");
            case "ReferenceServiceReferenceView"->Set.of("title","videoId").contains(field);
            case "SetlistServiceItemView"->Set.of("key","bpm","score","reference").contains(field);
            case "SetlistServiceBlock"->Set.of("cue","calling","note").contains(field);
            case "ExportServiceExportView"->Set.of("artifactHash","byteSize").contains(field);
            case "PlaylistServiceResult"->field.equals("playlistId");
            case "MemberNoticeServiceNoticeView"->Set.of("documentId","readAt").contains(field);
            case "ProfileServiceProfileView"->field.equals("displayName");
            case "DocumentAuthorizationPolicyPermissions"->field.equals("effectiveRole");
            default->false;
        };
    }
    static void constraints(Map<String,Object> schema,AnnotatedElement field){
        var size=field.getAnnotation(Size.class);if(size!=null){boolean array="array".equals(schema.get("type"));schema.put(array?"minItems":"minLength",size.min());schema.put(array?"maxItems":"maxLength",size.max());}
        if(field.isAnnotationPresent(NotBlank.class)){schema.put("minLength",1);schema.put("pattern","\\S");}
        if(field.isAnnotationPresent(Positive.class))schema.put("exclusiveMinimum",0);
        if(field.isAnnotationPresent(PositiveOrZero.class))schema.put("minimum",0);
    }
    @SuppressWarnings("unchecked") static Map<String,Object> nonNull(Object schema){var value=map(schema);return value.containsKey("anyOf")?map(((List<?>)value.get("anyOf")).getFirst()):value;}
    static void businessConstraints(Class<?> type,Map<String,Object> properties,List<String> fields,boolean request){
        if(!request)return;
        String name=type.getEnclosingClass().getSimpleName()+type.getSimpleName();
        if(name.equals("DocumentControllerCreate")||name.equals("DocumentControllerAccess")){if(properties.containsKey("accessPolicy"))nonNull(properties.get("accessPolicy")).put("enum",List.of("OPEN","RESTRICTED"));}
        if(name.equals("DocumentControllerGrant"))nonNull(properties.get("role")).put("enum",List.of("MANAGER","EDITOR","VIEWER"));
        if(name.equals("SetlistControllerUpdate")){nonNull(properties.get("title")).put("maxLength",200);nonNull(properties.get("notes")).put("maxLength",20000);}
        if(name.equals("SetlistControllerNotes"))nonNull(properties.get("notes")).put("maxLength",20000);
        if(name.equals("SetlistControllerOrder")){nonNull(properties.get("itemIds")).put("uniqueItems",true);}
        if(name.equals("SetlistControllerForm"))nonNull(properties.get("blocks")).put("maxItems",256);
        if(name.equals("SetlistServiceBlock")){
            for(String field:List.of("id","section")){properties.put(field,object("type","string","minLength",1,"maxLength",64,"pattern","\\S"));if(!fields.contains(field))fields.add(field);}
            nonNull(properties.get("repeat")).putAll(object("minimum",1,"maximum",1000));
            for(String field:List.of("cue","calling","note"))nonNull(properties.get(field)).put("maxLength",2000);
        }
        if(name.equals("SetlistControllerSettings")){
            nonNull(properties.get("key")).put("maxLength",32);
            nonNull(properties.get("bpm")).putAll(object("exclusiveMinimum",0,"maximum",9999.99,"multipleOf",0.01));
            nonNull(properties.get("sessions")).putAll(object("maxItems",32,"items",object("type","string","minLength",1,"maxLength",64,"pattern","\\S")));
        }
        if(name.equals("ReferenceControllerVideo"))nonNull(properties.get("videoId")).putAll(object("minLength",11,"pattern","^[A-Za-z0-9_-]{11}$"));
        if(name.equals("ReferenceControllerDirect"))nonNull(properties.get("url")).put("description","Absolute HTTP(S) URL with host and no userinfo; never fetched by Backend.");
        if(name.equals("YouTubeControllerCommand"))nonNull(properties.get("playlistId")).putAll(object("minLength",1,"maxLength",255,"pattern","^[A-Za-z0-9_-]+$"));
        if(name.equals("WorkspaceControllerTerminate"))nonNull(properties.get("confirmation")).putAll(object("minLength",64,"maxLength",64,"pattern","^[a-f0-9]{64}$"));
    }
    static String[] routes(RequestMapping mapping){return mapping==null||mapping.path().length==0?new String[]{""}:mapping.path();}
    Map<String,Object> expected()throws Exception{
        var root=read();var paths=map(root.get("paths"));schema(com.worship.core.shared.api.ApiError.class,false);
        for(Class<?> controller:CONTROLLERS){
            var prefix=AnnotatedElementUtils.findMergedAnnotation(controller,RequestMapping.class);
            for(Method method:controller.getDeclaredMethods()){
                var route=AnnotatedElementUtils.findMergedAnnotation(method,RequestMapping.class);if(route==null)continue;
                for(String base:routes(prefix))for(String suffix:routes(route))for(var verb:route.method()){
                    String path=base+suffix;var pathItem=map(paths.get(path));assertThat(pathItem).as("Existing route %s",path).isNotNull();pathItem.remove("parameters");
                    var op=map(pathItem.get(verb.name().toLowerCase(Locale.ROOT)));assertThat(op).isNotNull();
                    op.putIfAbsent("operationId",controller.getSimpleName()+"_"+method.getName());
                    boolean anonymous=path.equals("/api/health")||path.startsWith("/api/auth/");boolean mutate=verb!=RequestMethod.GET;
                    op.put("security",anonymous?(mutate?List.of(object("csrf",List.of())):List.of()):List.of(mutate?object("session",List.of(),"csrf",List.of()):object("session",List.of())));
                    if(mutate)op.put("x-csrf-header-source","GET /api/auth/csrf → headerName/token; refresh after login or session rotation");
                    List<Object> parameters=new ArrayList<>();Map<String,Object> multipart=new LinkedHashMap<>();List<String> requiredParts=new ArrayList<>();op.remove("requestBody");
                    for(Parameter parameter:method.getParameters()){
                        var body=parameter.getAnnotation(RequestBody.class);if(body!=null)op.put("requestBody",object("required",body.required(),"content",object("application/json",object("schema",schema(parameter.getParameterizedType(),true)))));
                        var variable=parameter.getAnnotation(PathVariable.class);var query=parameter.getAnnotation(RequestParam.class);var part=parameter.getAnnotation(RequestPart.class);
                        if(variable==null&&query==null&&part==null)continue;
                        String name=part!=null?part.value():variable!=null?variable.value():query.value();if(name.isBlank())name=parameter.getName();
                        var value=schema(parameter.getParameterizedType(),true);constraints(value,parameter);
                        if(name.equals("query"))value.putAll(object("minLength",1,"maxLength",200,"pattern","\\S"));
                        boolean required=part!=null?part.required():variable!=null||query.required();
                        if(part!=null||path.endsWith("/scores")&&mutate){multipart.put(name,value);if(required)requiredParts.add(name);}
                        else parameters.add(object("name",name,"in",variable!=null?"path":"query","required",required,"schema",value));
                    }
                    op.put("parameters",parameters);
                    if(!multipart.isEmpty())op.put("requestBody",object("required",true,"content",object("multipart/form-data",object("schema",object("type","object","required",requiredParts,"properties",multipart)))));
                    var status=AnnotatedElementUtils.findMergedAnnotation(method,ResponseStatus.class);String success=Integer.toString(status==null?200:status.code().value());
                    var old=map(op.get("responses"));var responses=new LinkedHashMap<String,Object>();
                    var response=old.containsKey(success)?map(old.get(success)):object("description","Completed; empty body");response.remove("content");
                    if(method.getReturnType()!=void.class){
                        if(method.getName().equals("download")){Map<String,Object> content=new LinkedHashMap<>();for(String media:path.contains("/scores/")?List.of("application/pdf","image/png","image/jpeg"):List.of("application/pdf"))content.put(media,object("schema",schema(byte[].class,false)));response.put("content",content);response.put("headers",object("Content-Disposition",object("description","Attachment filename","schema",object("type","string"))));}
                        else{var value=schema(method.getGenericReturnType(),false);
                            if(method.getReturnType()==Map.class){String field=method.getName().equals("csrf")?"headerName":method.getName().equals("health")?"status":method.getName().equals("state")?"connected":"authorizationUrl";var props=object(field,object("type",field.equals("connected")?"boolean":"string"));if(method.getName().equals("csrf"))props.put("token",object("type","string"));value=object("type","object","properties",props,"required",new ArrayList<>(props.keySet()));}
                            response.put("content",object("application/json",object("schema",value)));
                        }
                    }
                    responses.put(success,response);
                    for(String error:List.of("400","401","403","404","405","406","409","415","500","503"))responses.put(error,object("$ref","#/components/responses/Error"+error,"description",old.containsKey(error)?map(old.get(error)).get("description"):"Standard capability/protocol error; see ApiError.code and current authorization/provider configuration"));
                    op.put("responses",responses);
                    if(path.equals("/api/auth/signup")||path.equals("/api/auth/reset-password")||path.equals("/api/account/password")&&verb==RequestMethod.PUT||path.equals("/api/account/password/change")){
                        op.put("x-business-constraints","New password length 12–128; current-password verification only checks credential match. Email is canonicalized trim/lowercase; new verified ownership is unique.");
                        var media=map(map(map(op.get("requestBody")).get("content")).get("application/json"));media.put("schema",object("allOf",List.of(media.get("schema"),object("type","object","properties",object(path.endsWith("/change")?"newPassword":"password",object("type","string","minLength",12,"maxLength",128))))));
                    }
                }
            }
        }
        var logout=map(map(paths.get("/api/auth/logout")).get("post"));logout.put("security",List.of(object("session",List.of(),"csrf",List.of())));logout.put("responses",object("204",object("description","Session invalidated; empty body"),"403",object("description","CSRF rejected","content",object("application/json",object("schema",schema(com.worship.core.shared.api.ApiError.class,false))))));
        var components=map(root.get("components"));components.put("schemas",schemas);map(components.get("securitySchemes")).put("csrf",object("type","apiKey","in","header","name","X-CSRF-TOKEN","description","Use actual headerName/token from /api/auth/csrf, not a long-lived cached token"));
        Map<String,Object> errors=new TreeMap<>();
        for(var error:object("400",List.of("VALIDATION_FAILED"),"401",List.of("AUTHENTICATION_REQUIRED"),"403",List.of("ACCESS_DENIED","REAUTHENTICATION_REQUIRED","YOUTUBE_AUTHORIZATION_REQUIRED"),"404",List.of("NOT_FOUND","REQUEST_REJECTED"),"405",List.of("REQUEST_REJECTED"),"406",List.of("REQUEST_REJECTED"),"409",List.of("STATE_CONFLICT","VERSION_CONFLICT","CONSTRAINT_CONFLICT"),"415",List.of("REQUEST_REJECTED"),"500",List.of("INTERNAL_ERROR"),"503",List.of("PROVIDER_NOT_CONFIGURED","CREDENTIAL_KEY_NOT_CONFIGURED","EXTERNAL_PROVIDER_FAILURE","OBJECT_STORAGE_FAILURE","EXPORT_INTEGRITY_FAILURE")).entrySet())errors.put("Error"+error.getKey(),object("description","Standard error envelope","content",object("application/json",object("schema",object("allOf",List.of(schema(com.worship.core.shared.api.ApiError.class,false),object("type","object","properties",object("code",object("type","string","enum",error.getValue())))))))));
        components.put("responses",errors);
        for(String path:List.of("/oauth2/authorization/google","/login/oauth2/code/google")){
            boolean callback=path.contains("/code/");Map<String,Object> responses=new LinkedHashMap<>();
            responses.put(callback?"204":"302",callback?object("description","Validated Google sign-in/link/reauthentication; rotated JDBC session; empty body"):object("description","Redirect to configured Google provider; browser navigation, not fetch","headers",object("Location",object("schema",object("type","string","format","uri")))));
            for(String error:List.of("400","401","403","404","409","500"))responses.put(error,object("description","OIDC_AUTHENTICATION_FAILED for invalid provider verification (401), GOOGLE_IDENTITY_REJECTED for domain rejection; 404 when registration is disabled","content",object("application/json",object("schema",schema(com.worship.core.shared.api.ApiError.class,false)))));
            paths.put(path,object("get",object("operationId",callback?"googleOidcCallback":"googleOidcRedirect","description","Spring Security endpoint; available only with explicitly configured Google client registration. LINK/REAUTHENTICATE begins at the account intent capability. DB-backed single-use state and nonce/signature/issuer/audience checks apply.","security",List.of(),"parameters",callback?List.of(object("in","query","name","state","required",true,"schema",object("type","string")),object("in","query","name","code","required",false,"schema",object("type","string")),object("in","query","name","error","required",false,"schema",object("type","string"))):List.of(),"responses",responses)));
        }
        return root;
    }
    @Test void shippedContractMatchesDtoBodiesParametersReturnShapesStatusesAndSecurity()throws Exception{
        var expected=expected();Path candidate=Path.of("build/reports/contracts/openapi-candidate.yaml");Files.createDirectories(candidate.getParent());var options=new org.yaml.snakeyaml.DumperOptions();options.setDefaultFlowStyle(org.yaml.snakeyaml.DumperOptions.FlowStyle.BLOCK);options.setWidth(120);Files.writeString(candidate,new org.yaml.snakeyaml.Yaml(options).dump(JSON.readValue(JSON.writeValueAsString(expected),Object.class)));
        assertThat(read().equals(expected)).as("Reviewed static OpenAPI must match the candidate in %s",candidate).isTrue();
    }
    @Test void schemaValidationRejectsMissingWrongTypedAndOutOfRangeFixtures()throws Exception{
        var schemas=map(map(read().get("components")).get("schemas"));
        var update=object("$ref","#/components/schemas/SetlistControllerUpdateRequest");
        assertThatThrownBy(()->validate(schemas,update,object("title","valid","notes",""))).isInstanceOf(AssertionError.class);
        assertThatThrownBy(()->validate(schemas,update,object("title","valid","notes","","expectedVersion","0"))).isInstanceOf(AssertionError.class);
        assertThatThrownBy(()->validate(schemas,update,object("title","valid","notes","","expectedVersion",-1))).isInstanceOf(AssertionError.class);
        validate(schemas,update,object("title","valid","notes","","expectedVersion",0));
        validate(schemas,object("$ref","#/components/schemas/SetlistControllerReferenceSelectionRequest"),object("referenceId",null,"expectedVersion",0));
    }
    static void validate(Map<String,Object> schemas,Map<String,Object> schema,Object value){
        assertThat(schema).as("Resolved schema").isNotNull();
        if(schema.containsKey("allOf")){for(Object option:(List<?>)schema.get("allOf"))validate(schemas,map(option),value);return;}
        if(schema.containsKey("$ref")){validate(schemas,map(schemas.get(schema.get("$ref").toString().substring("#/components/schemas/".length()))),value);return;}
        if(schema.containsKey("anyOf")){for(Object option:(List<?>)schema.get("anyOf"))try{validate(schemas,map(option),value);return;}catch(AssertionError ignored){}throw new AssertionError("No matching nullable schema for "+value);}
        String type=(String)schema.get("type");
        switch(type){
            case "null"->assertThat(value).isNull();
            case "object"->{assertThat(value).isInstanceOf(Map.class);var fields=map(value);for(Object required:(List<?>)schema.getOrDefault("required",List.of()))assertThat(fields.containsKey(required)).as("Required %s",required).isTrue();var props=map(schema.getOrDefault("properties",Map.of()));for(var field:fields.entrySet())if(props.containsKey(field.getKey()))validate(schemas,map(props.get(field.getKey())),field.getValue());else if(schema.get("additionalProperties") instanceof Map<?,?> extra)validate(schemas,map(extra),field.getValue());}
            case "array"->{assertThat(value).isInstanceOf(List.class);var values=(List<?>)value;assertThat(values.size()).isBetween(((Number)schema.getOrDefault("minItems",0)).intValue(),((Number)schema.getOrDefault("maxItems",Integer.MAX_VALUE)).intValue());if(Boolean.TRUE.equals(schema.get("uniqueItems")))assertThat(new HashSet<>(values)).hasSize(values.size());for(Object item:values)validate(schemas,map(schema.get("items")),item);}
            case "string"->{assertThat(value).isInstanceOf(String.class);String text=(String)value;assertThat(text.length()).isBetween(((Number)schema.getOrDefault("minLength",0)).intValue(),((Number)schema.getOrDefault("maxLength",Integer.MAX_VALUE)).intValue());if(schema.containsKey("pattern"))assertThat(java.util.regex.Pattern.compile(schema.get("pattern").toString()).matcher(text).find()).isTrue();if("date-time".equals(schema.get("format")))Instant.parse(text);}
            case "integer","number"->{assertThat(value).isInstanceOf(Number.class);double number=((Number)value).doubleValue();if(type.equals("integer"))assertThat(number).isEqualTo(Math.rint(number));if(schema.containsKey("minimum"))assertThat(number).isGreaterThanOrEqualTo(((Number)schema.get("minimum")).doubleValue());if(schema.containsKey("exclusiveMinimum"))assertThat(number).isGreaterThan(((Number)schema.get("exclusiveMinimum")).doubleValue());if(schema.containsKey("maximum"))assertThat(number).isLessThanOrEqualTo(((Number)schema.get("maximum")).doubleValue());}
            case "boolean"->assertThat(value).isInstanceOf(Boolean.class);
            default->throw new AssertionError("Unknown schema type "+type);
        }
        if(schema.containsKey("enum"))assertThat(((List<?>)schema.get("enum")).contains(value)).isTrue();
    }
    static void validateHttp(String method,String path,int status,byte[] body)throws Exception{
        var root=read();var paths=map(root.get("paths"));String route=paths.keySet().stream().filter(candidate->map(paths.get(candidate)).containsKey(method.toLowerCase(Locale.ROOT))).sorted(Comparator.comparingLong(candidate->candidate.chars().filter(c->c=='{').count())).filter(candidate->path.split("\\?",2)[0].matches(candidate.replaceAll("\\{[^}]+}","[^/]+"))).findFirst().orElseThrow();
        var response=map(map(map(map(paths.get(route)).get(method.toLowerCase(Locale.ROOT))).get("responses")).get(Integer.toString(status)));assertThat(response).as("%s %s %s",method,path,status).isNotNull();
        if(response.containsKey("$ref"))response=map(map(map(root.get("components")).get("responses")).get(response.get("$ref").toString().substring("#/components/responses/".length())));
        if(!response.containsKey("content")){assertThat(body).isEmpty();return;}
        var schema=map(map(map(response.get("content")).get("application/json")).get("schema"));validate(map(map(root.get("components")).get("schemas")),schema,JSON.readValue(body,Object.class));
    }
}
