package com.worship.core.integration.youtube;
/** Never contains raw provider responses or credentials. */
public class ProviderFailure extends RuntimeException {
    private final boolean uncertain;
    public ProviderFailure(boolean uncertain){super("YouTube provider operation failed");this.uncertain=uncertain;}
    public boolean uncertain(){return uncertain;}
}
