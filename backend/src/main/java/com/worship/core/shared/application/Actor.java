package com.worship.core.shared.application;
import java.time.Instant;
/** Authenticated identity; never includes workspace roles or document grants. */
public record Actor(long userId, long sessionVersion, Instant reauthenticatedAt) {}
