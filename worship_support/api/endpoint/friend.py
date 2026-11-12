from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import AuthenticateAccount, behavior
from worship_support.api.usecase import friend_block
from worship_support.api.usecase import friend_by_link
from worship_support.api.usecase import friend_link
from worship_support.api.usecase import friend_request
from worship_support.api.usecase import friend_respond
from worship_support.api.usecase import friend_search


# #
# query

async def get_search(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await friend_search.search(session=scope.session, input=friend_search.Input(), user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


# #
# command

async def post_request(body: friend_request.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    requested = await friend_request.request(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=requested.to_dict())


async def post_respond(body: friend_respond.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    responded = await friend_respond.respond(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=responded.to_dict())


async def post_block(body: friend_block.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    blocked = await friend_block.block(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=blocked.to_dict())


async def post_link(body: friend_link.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await friend_link.get(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def post_by_link(body: friend_by_link.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await friend_by_link.by_link(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())
