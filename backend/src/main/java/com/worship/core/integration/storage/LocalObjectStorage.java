package com.worship.core.integration.storage;
import java.nio.file.*;
import java.io.IOException;
import java.util.Arrays;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.CapabilityException;
public class LocalObjectStorage implements ObjectStorage {
    private final Path root;
    public LocalObjectStorage(Path root){try{Files.createDirectories(root);this.root=root.toRealPath();}catch(IOException e){throw failure();}}
    private Path file(String key){return root.resolve(IdentityService.hash(key));}
    public void put(String key,byte[] bytes,String mediaType){try{Files.write(file(key),bytes,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException e){if(!Arrays.equals(get(key),bytes))throw failure();}catch(IOException e){throw failure();}}
    public byte[] get(String key){try{if(Files.isSymbolicLink(file(key)))throw failure();return Files.readAllBytes(file(key));}catch(IOException e){throw failure();}}
    public void delete(String key){try{Files.deleteIfExists(file(key));}catch(IOException e){throw failure();}}
    private static CapabilityException failure(){return new CapabilityException(503,"OBJECT_STORAGE_FAILURE","Object storage operation failed");}
}
