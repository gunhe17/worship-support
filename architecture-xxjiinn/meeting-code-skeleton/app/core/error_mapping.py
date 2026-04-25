from app.core.error_codes import ErrorCode


ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.COMMON_INTERNAL_SERVER_ERROR: 500,
    ErrorCode.COMMON_VALIDATION_ERROR: 400,
    ErrorCode.AUTH_INVALID_CREDENTIALS: 401,
    ErrorCode.AUTH_USER_NOT_ACTIVE: 403,
    ErrorCode.AUTH_EMAIL_ALREADY_EXISTS: 409,
    ErrorCode.AUTH_UNAUTHENTICATED: 401,
    ErrorCode.AUTH_REFRESH_TOKEN_REUSED: 401,
}

ERROR_MESSAGE: dict[ErrorCode, str] = {
    ErrorCode.COMMON_INTERNAL_SERVER_ERROR: "Internal server error.",
    ErrorCode.COMMON_VALIDATION_ERROR: "Validation failed.",
    ErrorCode.AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
    ErrorCode.AUTH_USER_NOT_ACTIVE: "User is not active.",
    ErrorCode.AUTH_EMAIL_ALREADY_EXISTS: "Email already exists.",
    ErrorCode.AUTH_UNAUTHENTICATED: "Authentication is required.",
    ErrorCode.AUTH_REFRESH_TOKEN_REUSED: "Refresh token was reused.",
}

ERROR_LOG_LEVEL: dict[ErrorCode, str] = {
    ErrorCode.COMMON_INTERNAL_SERVER_ERROR: "error",
    ErrorCode.COMMON_VALIDATION_ERROR: "info",
    ErrorCode.AUTH_INVALID_CREDENTIALS: "warning",
    ErrorCode.AUTH_USER_NOT_ACTIVE: "warning",
    ErrorCode.AUTH_EMAIL_ALREADY_EXISTS: "info",
    ErrorCode.AUTH_UNAUTHENTICATED: "warning",
    ErrorCode.AUTH_REFRESH_TOKEN_REUSED: "warning",
}
