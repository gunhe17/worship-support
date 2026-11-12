from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.friend_send import send


# #
# input

class Input(CoreIn):
    user_id: UUID


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def request(*, session, input: Input, user_id: UUID) -> Output:
    # find
    if input.user_id != user_id and not await WorkspaceMemberRepository.shares_workspace(
        session=session,
        user_id=user_id,
        other_user_id=input.user_id,
    ):
        raise StateError("friend_unreachable")

    # request
    friendship, result = await send(
        session=session,
        user_id=user_id,
        target_user_id=input.user_id,
        now=await Clock.now(session=session),
    )

    # return
    return Output(
        data={**friendship.to_dict(), "result": result},
        event=[],
    )
