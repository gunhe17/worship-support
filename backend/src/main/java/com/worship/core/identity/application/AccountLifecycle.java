package com.worship.core.identity.application;

/**
 * Participating features check responsibility and end associations in the account transaction.
 */
public interface AccountLifecycle {
    void beforeWithdraw(long userId);
}
