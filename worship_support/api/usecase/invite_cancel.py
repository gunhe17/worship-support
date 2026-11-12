from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock


# #
# input

class Input(CoreIn):
    kind: Literal["email", "friend"]
    id: UUID


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def cancel(*, session, input: Input, workspace_id: UUID) -> Output:
    # find
    now = Moment.from_datetime(await Clock.now(session=session))
    repository = WorkspaceInviteRepository if input.kind == "email" else WorkspaceUserInviteRepository
    invite = await repository.tenanted_get_by_id(
        session=session,
        workspace_id=workspace_id,
        id=input.id,
    )
    if not invite.is_live(now=now):
        raise StateError("invite_closed")

    # persist
    canceled = await repository.tenanted_update(
        session=session,
        entity=invite.expire(at=now),
    )

    # return
    return Output(
        data=canceled.to_dict(),
        event=[],
    )
