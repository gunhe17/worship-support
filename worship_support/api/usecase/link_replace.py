from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace_public_link.workspace_public_link_repository import WorkspacePublicLinkRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase import link_get


# #
# input

class Input(CoreIn):
    mode: Literal["replace", "disable"]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def replace(*, session, input: Input, workspace_id: UUID) -> Output:
    # find
    now = Moment.from_datetime(await Clock.now(session=session))
    link = await WorkspacePublicLinkRepository.tenanted_find_live(
        session=session,
        workspace_id=workspace_id,
        lock=True,
    )

    # replace
    if link is not None:
        await WorkspacePublicLinkRepository.tenanted_update(
            session=session,
            entity=link.disable(at=now),
        )
    if input.mode == "disable":
        return Output(
            data={"enabled": False},
            event=[],
        )

    # return
    return await link_get.get(
        session=session,
        input=link_get.Input(),
        workspace_id=workspace_id,
    )
