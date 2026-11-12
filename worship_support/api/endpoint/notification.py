from __future__ import annotations

from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import AuthenticateAccount, behavior
from worship_support.api.usecase import notification_read
from worship_support.api.usecase import notification_search


# #
# query

async def get_search(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    found = await notification_search.search(session=scope.session, input=notification_search.Input(), user_id=scope.user_id)
    return JSONResponse(status_code=200, content=found.to_dict())


# #
# command

async def post_read(*, scope=Depends(behavior.request(AuthenticateAccount()))) -> JSONResponse:
    read = await notification_read.read(session=scope.session, input=notification_read.Input(), user_id=scope.user_id)
    return JSONResponse(status_code=200, content=read.to_dict())
