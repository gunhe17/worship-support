from __future__ import annotations

from fastapi import Depends, Request
from starlette.responses import JSONResponse

from worship_support.api.behavior import SESSION_COOKIE, AuthenticateAccount, behavior
from worship_support.api.config import get_policy_config, is_develop
from worship_support.api.usecase import auth_develop_login
from worship_support.api.usecase import auth_logout


# #
# command

async def post_develop_login(
    body: auth_develop_login.Input,
    request: Request,
    *,
    scope=Depends(behavior.request()),
) -> JSONResponse:
    logged = await auth_develop_login.login(
        session=scope.session,
        input=body.model_copy(update={"device_label": body.device_label or request.headers.get("user-agent")}),
    )
    payload = logged.to_dict()
    raw = payload["data"].pop("token")
    response = JSONResponse(status_code=200, content=payload)
    response.set_cookie(
        SESSION_COOKIE,
        raw,
        max_age=get_policy_config().SESSION_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=not is_develop(),
    )
    return response


async def post_logout(
    *,
    scope=Depends(behavior.request(AuthenticateAccount())),
) -> JSONResponse:
    logged = await auth_logout.logout(
        session=scope.session,
        input=auth_logout.Input(),
        user_id=scope.user_id,
        login_session_id=scope.login_session_id,
    )
    response = JSONResponse(status_code=200, content=logged.to_dict())
    response.delete_cookie(SESSION_COOKIE)
    return response
