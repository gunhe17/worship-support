from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Request, Response

from app.core.auth import get_current_actor_id
from app.core.container import auth_audit_logger, refresh_token_repository, token_service, user_repository
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.domains.auth.cookies import delete_auth_cookies
from app.domains.auth.schema import UserResponse
from app.domains.auth.usecase import GetCurrentUserUsecase
from app.domains.user.usecase import WithdrawCurrentUserUsecase

router = APIRouter(prefix="/users", tags=["user"])


def _build_me_usecase() -> GetCurrentUserUsecase:
    return GetCurrentUserUsecase(
        user_repository=user_repository,
        token_service=token_service,
    )


def _build_withdraw_usecase() -> WithdrawCurrentUserUsecase:
    return WithdrawCurrentUserUsecase(
        user_repository=user_repository,
        refresh_token_repository=refresh_token_repository,
    )


def _safe_audit_log(**kwargs) -> None:
    try:
        auth_audit_logger.log(**kwargs)
    except Exception:
        return


@router.get("/me")
def me(access_token: str | None = Cookie(default=None)) -> dict[str, UserResponse]:
    if access_token is None:
        raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)
    user = _build_me_usecase().execute(access_token)
    return {"data": user}


@router.post("/me/withdraw")
def withdraw_me(
    response: Response,
    raw_request: Request,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, object]:
    try:
        user = _build_withdraw_usecase().execute(actor_id)
        delete_auth_cookies(response)
        _safe_audit_log(
            event_type="user.withdraw",
            result="success",
            user_id=user.id,
            email=user.email.value,
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
        )
        return {"data": {"withdrawn": True}}
    except AppError as exc:
        _safe_audit_log(
            event_type="user.withdraw",
            result="failure",
            user_id=actor_id,
            client_ip=raw_request.client.host if raw_request.client else None,
            user_agent=raw_request.headers.get("user-agent"),
            reason=exc.error_code.value,
        )
        raise
