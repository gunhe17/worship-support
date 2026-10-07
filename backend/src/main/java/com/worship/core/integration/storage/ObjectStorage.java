package com.worship.core.integration.storage;
/**
 * Object keys are write-once: repeated put may accept identical bytes, but must
 * reject different bytes at an existing key. New Score content needs a new key
 * and row; exports retain their snapshot's immutable Score IDs. Production
 * adapters must verify this contract before enabling provider access.
 */
public interface ObjectStorage {
    void put(String key,byte[] bytes,String mediaType);
    byte[] get(String key);
    void delete(String key);
}
