from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import AuthenticateAccount, behavior
from worship_support.api.usecase import join_answer_invite
from worship_support.api.usecase import join_by_code
from worship_support.api.usecase import join_by_link
from worship_support.api.usecase import join_check_code
from worship_support.api.usecase import join_check_link


# #
# command

async def post_check_code(body: join_check_code.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await join_check_code.check(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def post_code(body: join_by_code.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    joined = await join_by_code.join(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=joined.to_dict())


async def post_check_link(body: join_check_link.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await join_check_link.check(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def post_link(body: join_by_link.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    joined = await join_by_link.join(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=joined.to_dict())


async def post_answer_invite(body: join_answer_invite.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    answered = await join_answer_invite.answer(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=answered.to_dict())
