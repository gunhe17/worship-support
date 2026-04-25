from __future__ import annotations

from fastapi import Cookie

from app.core.container import token_service
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError


def get_current_actor_id(access_token: str | None = Cookie(default=None)) -> str:
    if access_token is None:
        raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)
    return token_service.verify_access_token(access_token).user_id
