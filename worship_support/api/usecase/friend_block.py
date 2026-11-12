from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.user_block.user_block import UserBlock
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock


# #
# input

class Input(CoreIn):
    user_id: UUID
    action: Literal["block", "unblock"]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def block(*, session, input: Input, user_id: UUID) -> Output:
    # find
    if input.user_id == user_id:
        raise StateError("friend_self")
    now = Moment.from_datetime(await Clock.now(session=session))
    await UserRepository.lock(
        session=session,
        ids=[user_id, input.user_id],
    )
    await UserRepository.get_by_id(
        session=session,
        id=input.user_id,
    )
    live = await UserBlockRepository.find_live(
        session=session,
        user_id=user_id,
        blocked_user_id=input.user_id,
    )

    # unblock
    if input.action == "unblock":
        if live is not None:
            await UserBlockRepository.update(
                session=session,
                entity=live.end(at=now),
            )
        return Output(
            data={"user_id": str(input.user_id), "blocked": False},
            event=[],
        )

    # block
    if live is None:
        friendship = await FriendshipRepository.find_live_between(
            session=session,
            user_id=user_id,
            other_user_id=input.user_id,
        )
        if friendship is not None:
            await FriendshipRepository.update_pair(
                session=session,
                entity=friendship.end(at=now),
            )
        await UserBlockRepository.add(
            session=session,
            entity=UserBlock.new(
                user_id=user_id,
                blocked_user_id=input.user_id,
            ),
        )

    # return
    return Output(
        data={"user_id": str(input.user_id), "blocked": True},
        event=[],
    )
