from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import AuthenticateAccount, AuthorizeManager, AuthorizeMember, behavior
from worship_support.api.usecase import document_create
from worship_support.api.usecase import document_search
from worship_support.api.usecase import group_create
from worship_support.api.usecase import group_search
from worship_support.api.usecase import member_remove
from worship_support.api.usecase import member_search
from worship_support.api.usecase import workspace_close
from worship_support.api.usecase import workspace_create
from worship_support.api.usecase import workspace_get
from worship_support.api.usecase import workspace_leave
from worship_support.api.usecase import workspace_search
from worship_support.api.usecase import workspace_transfer
from worship_support.api.usecase import workspace_update


# #
# query

async def get_search(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await workspace_search.search(session=scope.session, input=workspace_search.Input(), user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def get_one(*, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    found = await workspace_get.get(
        session=scope.session,
        input=workspace_get.Input(),
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=found.to_dict())


async def get_members(*, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    found = await member_search.search(
        session=scope.session,
        input=member_search.Input(),
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=found.to_dict())


async def get_groups(*, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    found = await group_search.search(session=scope.session, input=group_search.Input(), workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=found.to_dict())


# #
# command

async def post_create(body: workspace_create.Input, *, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    created = await workspace_create.create(session=scope.session, input=body, user_id=scope.user_id)
    return JSONResponse(status_code=200, content=created.to_dict())


async def patch_one(body: workspace_update.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    updated = await workspace_update.update(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=updated.to_dict())


async def post_close(body: workspace_close.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    closed = await workspace_close.close(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=closed.to_dict())


async def post_transfer(body: workspace_transfer.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    transferred = await workspace_transfer.transfer(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=transferred.to_dict())


async def post_leave(*, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    left = await workspace_leave.leave(
        session=scope.session,
        input=workspace_leave.Input(),
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=left.to_dict())


async def post_remove_member(body: member_remove.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    removed = await member_remove.remove(
        session=scope.session,
        input=body,
        workspace_id=scope.workspace_id,
        user_id=scope.user_id,
    )
    return JSONResponse(status_code=200, content=removed.to_dict())


async def post_group(body: group_create.Input, *, scope=Depends(behavior.request_workspace(AuthorizeManager()))) -> JSONResponse:
    created = await group_create.create(session=scope.session, input=body, workspace_id=scope.workspace_id)
    return JSONResponse(status_code=200, content=created.to_dict())


async def get_documents(*, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    found = await document_search.search(session=scope.session, input=document_search.Input(), workspace_id=scope.workspace_id, member_id=scope.member_id)
    return JSONResponse(status_code=200, content=found.to_dict())


async def post_document(body: document_create.Input, *, scope=Depends(behavior.request_workspace(AuthorizeMember()))) -> JSONResponse:
    created = await document_create.create(session=scope.session, input=body, workspace_id=scope.workspace_id, member_id=scope.member_id)
    return JSONResponse(status_code=200, content=created.to_dict())
