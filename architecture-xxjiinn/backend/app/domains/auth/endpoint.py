from __future__ import annotations

from fastapi import APIRouter, Cookie, Header, Request, Response

from app.core.audit import AuthAuditLogger
from app.core.container import (
    auth_audit_logger,
    password_hasher,
    refresh_token_repository,
    refresh_token_service,
    token_service,
    user_repository,
)
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.domains.auth.cookies import (
    delete_auth_cookies,
    set_access_cookie,
    set_csrf_cookie,
    set_refresh_cookie,
)
from app.domains.auth.schema import LoginRequest, SignupRequest, UserResponse
from app.domains.auth.usecase import (
    LoginUsecase,
    LogoutUsecase,
    RefreshUsecase,
    SignupUsecase,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_signup_usecase() -> SignupUsecase:
    return SignupUsecase(
        user_repository=user_repository,
        password_hasher=password_hasher,
    )


def _build_login_usecase() -> LoginUsecase:
    return LoginUsecase(
        user_repository=user_repository,
        password_hasher=password_hasher,
        token_service=token_service,
        refresh_token_repository=refresh_token_repository,
        refresh_token_service=refresh_token_service,
    )


def _build_refresh_usecase() -> RefreshUsecase:
    return RefreshUsecase(
        user_repository=user_repository,
        token_service=token_service,
        refresh_token_repository=refresh_token_repository,
        refresh_token_service=refresh_token_service,
    )


def _build_logout_usecase() -> LogoutUsecase:
    return LogoutUsecase(
        refresh_token_repository=refresh_token_repository,
        refresh_token_service=refresh_token_service,
    )


def _ensure_csrf(csrf_cookie: str | None, csrf_header: str | None) -> None:
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise AppError(ErrorCode.AUTH_CSRF_TOKEN_INVALID)


def _safe_audit_log(logger: AuthAuditLogger, **kwargs) -> None:
    try:
        logger.log(**kwargs)
    except Exception:
        return


@router.post("/signup", status_code=201)
def signup(request: SignupRequest, raw_request: Request) -> dict[str, UserResponse]:
    try:
        user = _build_signup_usecase().execute(request)
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.signup",
            result="success",
            user_id=user.id,
            email=user.email,
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
        )
        return {"data": user}
    except AppError as exc:
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.signup",
            result="failure",
            email=str(request.email),
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
            reason=exc.error_code.value,
        )
        raise


@router.post("/login")
def login(request: LoginRequest, response: Response, raw_request: Request) -> dict[str, UserResponse]:
    try:
        result = _build_login_usecase().execute(request)
        set_access_cookie(response, result.access_token)
        set_refresh_cookie(response, result.refresh_token)
        set_csrf_cookie(response, result.csrf_token)
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.login",
            result="success",
            user_id=result.user.id,
            email=result.user.email,
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
        )
        return {"data": result.user}
    except AppError as exc:
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.login",
            result="failure",
            email=str(request.email),
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
            reason=exc.error_code.value,
        )
        raise


@router.post("/refresh")
def refresh(
    response: Response,
    raw_request: Request,
    refresh_token: str | None = Cookie(default=None),
    csrf_token: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> dict[str, object]:
    try:
        if refresh_token is None:
            raise AppError(ErrorCode.AUTH_REFRESH_TOKEN_INVALID)
        _ensure_csrf(csrf_token, x_csrf_token)
        result = _build_refresh_usecase().execute(refresh_token)
        set_access_cookie(response, result.access_token)
        set_refresh_cookie(response, result.refresh_token)
        set_csrf_cookie(response, result.csrf_token)
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.refresh",
            result="success",
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
        )
        return {"data": {"refreshed": True}}
    except AppError as exc:
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.refresh",
            result="failure",
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
            reason=exc.error_code.value,
        )
        raise


@router.post("/logout")
def logout(
    response: Response,
    raw_request: Request,
    refresh_token: str | None = Cookie(default=None),
    csrf_token: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> dict[str, object]:
    try:
        if refresh_token is not None:
            _ensure_csrf(csrf_token, x_csrf_token)
        _build_logout_usecase().execute(refresh_token)
        delete_auth_cookies(response)
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.logout",
            result="success",
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
        )
        return {"data": {"logged_out": True}}
    except AppError as exc:
        _safe_audit_log(
            auth_audit_logger,
            event_type="auth.logout",
            result="failure",
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
            reason=exc.error_code.value,
        )
        raise
