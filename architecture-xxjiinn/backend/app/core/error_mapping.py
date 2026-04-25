from app.core.error_codes import ErrorCode


ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.COMMON_INTERNAL_SERVER_ERROR: 500,
    ErrorCode.COMMON_VALIDATION_ERROR: 400,
    ErrorCode.AUTH_INVALID_CREDENTIALS: 401,
    ErrorCode.AUTH_USER_NOT_ACTIVE: 403,
    ErrorCode.AUTH_EMAIL_ALREADY_EXISTS: 409,
    ErrorCode.AUTH_UNAUTHENTICATED: 401,
    ErrorCode.AUTH_CSRF_TOKEN_INVALID: 403,
    ErrorCode.AUTH_REFRESH_TOKEN_INVALID: 401,
    ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED: 401,
    ErrorCode.AUTH_REFRESH_TOKEN_REUSED: 401,
    ErrorCode.WORKSPACE_OWNER_TRANSFER_REQUIRED: 409,
    ErrorCode.WORKSPACE_INVITE_INVALID: 400,
    ErrorCode.WORKSPACE_FORBIDDEN: 403,
    ErrorCode.WORKSPACE_NOT_FOUND: 404,
    ErrorCode.PROJECT_NOT_FOUND: 404,
    ErrorCode.PROJECT_FORBIDDEN: 403,
}

ERROR_MESSAGE: dict[ErrorCode, str] = {
    ErrorCode.COMMON_INTERNAL_SERVER_ERROR: "Internal server error.",
    ErrorCode.COMMON_VALIDATION_ERROR: "Validation failed.",
    ErrorCode.AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
    ErrorCode.AUTH_USER_NOT_ACTIVE: "User is not active.",
    ErrorCode.AUTH_EMAIL_ALREADY_EXISTS: "Email already exists.",
    ErrorCode.AUTH_UNAUTHENTICATED: "Authentication is required.",
    ErrorCode.AUTH_CSRF_TOKEN_INVALID: "CSRF token is invalid.",
    ErrorCode.AUTH_REFRESH_TOKEN_INVALID: "Refresh token is invalid.",
    ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED: "Refresh token has expired.",
    ErrorCode.AUTH_REFRESH_TOKEN_REUSED: "Refresh token was reused.",
    ErrorCode.WORKSPACE_OWNER_TRANSFER_REQUIRED: "Owner transfer is required.",
    ErrorCode.WORKSPACE_INVITE_INVALID: "Workspace invite is invalid.",
    ErrorCode.WORKSPACE_FORBIDDEN: "Workspace access is forbidden.",
    ErrorCode.WORKSPACE_NOT_FOUND: "Workspace not found.",
    ErrorCode.PROJECT_NOT_FOUND: "Project not found.",
    ErrorCode.PROJECT_FORBIDDEN: "Project access is forbidden.",
}
