package com.worship.core.shared.application;
public final class Errors {
    private Errors() {}
    public static CapabilityException invalid(String message) { return new CapabilityException(400, "VALIDATION_FAILED", message); }
    public static CapabilityException unauthenticated() { return new CapabilityException(401, "AUTHENTICATION_REQUIRED", "Authentication required"); }
    public static CapabilityException forbidden() { return new CapabilityException(403, "ACCESS_DENIED", "Access denied"); }
    public static CapabilityException conflict(String message) { return new CapabilityException(409, "STATE_CONFLICT", message); }
    public static CapabilityException missing() { return new CapabilityException(404, "NOT_FOUND", "Resource not found"); }
}
