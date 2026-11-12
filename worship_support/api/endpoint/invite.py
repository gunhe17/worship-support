from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import AuthorizeManager, behavior
from worship_support.api.usecase import invite_cancel
from worship_support.api.usecase import invite_resend
from worship_support.api.usecase import invite_search
from worship_support.api.usecase import invite_send_email
from worship_support.api.usecase import invite_send_friend
from worship_support.api.usecase import link_get
from worship_support.api.usecase import link_replace


# #
# query

async def get_search(*, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    found = await invite_search.search(session=scope.session, input=invite_search.Input(), workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=found.to_dict())


# #
# command

async def post_email(body: invite_send_email.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    sent = await invite_send_email.send(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=sent.to_dict())


async def post_friend(body: invite_send_friend.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    sent = await invite_send_friend.send(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=sent.to_dict())


async def post_cancel(body: invite_cancel.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    canceled = await invite_cancel.cancel(session=scope.session, input=body, workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=canceled.to_dict())


async def post_resend(body: invite_resend.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    resent = await invite_resend.resend(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=resent.to_dict())


async def post_link(*, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    found = await link_get.get(session=scope.session, input=link_get.Input(), workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def post_link_replace(body: link_replace.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    replaced = await link_replace.replace(session=scope.session, input=body, workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=replaced.to_dict())
