package com.worship.core.integration.storage;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.context.annotation.*;
import com.worship.core.shared.application.CapabilityException;
@Configuration
public class StorageConfiguration {
    @Bean @ConditionalOnProperty(name="worship.storage.local.enabled",havingValue="true")
    ObjectStorage localStorage(@Value("${worship.storage.local.root:.local/objects}") String root){return new LocalObjectStorage(Path.of(root));}
    @Bean @ConditionalOnMissingBean(ObjectStorage.class)
    @ConditionalOnProperty(name="worship.storage.local.enabled",havingValue="false",matchIfMissing=true)
    ObjectStorage unavailableStorage(){return new ObjectStorage(){
        private RuntimeException fail(){return new CapabilityException(503,"PROVIDER_NOT_CONFIGURED","Object storage provider not configured");}
        public void put(String k,byte[] b,String m){throw fail();}public byte[] get(String k){throw fail();}public void delete(String k){throw fail();}
    };}
}
