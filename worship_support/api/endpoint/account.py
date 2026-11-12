from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import SESSION_COOKIE, AuthenticateAccount, behavior
from worship_support.api.usecase import account_get
from worship_support.api.usecase import account_revoke_session
from worship_support.api.usecase import account_search_session
from worship_support.api.usecase import account_update
from worship_support.api.usecase import account_withdraw


# #
# query

async def get_me(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await account_get.get(session=scope.session, input=account_get.Input(), user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def get_sessions(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await account_search_session.search(
        session=scope.session,
        input=account_search_session.Input(),
        user_id=scope.user_id,
        login_session_id=scope.login_session_id,
    )
    return JSONResponse(status_code=200, content=found.to_dict())


# #
# command

async def patch_me(body: account_update.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    updated = await account_update.update(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=updated.to_dict())


async def post_revoke_session(body: account_revoke_session.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    revoked = await account_revoke_session.revoke(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=revoked.to_dict())


async def post_withdraw(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    withdrawn = await account_withdraw.withdraw(session=scope.session, input=account_withdraw.Input(), user_id=scope.user_id)
    response = JSONResponse(status_code=200, content=withdrawn.to_dict())
    response.delete_cookie(SESSION_COOKIE)
    return response
