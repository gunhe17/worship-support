from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.friend_link.friend_link_repository import FriendLinkRepository
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.friend_send import send
from worship_support.api.usecase.person import describe
from worship_support.api.usecase.secret import token_hash


# #
# input

class Input(CoreIn):
    token: str
    action: Literal["check", "request"] = "check"


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def by_link(*, session, input: Input, user_id: UUID) -> Output:
    # find
    link = await FriendLinkRepository.get_live_by_token_hash(
        session=session,
        token_hash=token_hash(value=input.token),
    )
    owner_id = link.user_id
    people = await describe(
        session=session,
        user_ids=[owner_id],
    )
    owner = {"id": str(owner_id), "name": people[owner_id]["name"]} if owner_id in people else None
    if owner is None:
        raise StateError("link_unusable")

    # check
    if input.action == "check":
        live = await FriendshipRepository.find_live_between(
            session=session,
            user_id=user_id,
            other_user_id=owner_id,
        )
        blocked = await UserBlockRepository.verify_blocked_either_way(
            session=session,
            user_id=user_id,
            other_user_id=owner_id,
        )
        return Output(
            data={
                "owner": owner,
                "me": owner_id == user_id,
                "relation": "blocked" if blocked else (live.state() if live else "none"),
            },
            event=[],
        )

    # request
    friendship, result = await send(
        session=session,
        user_id=user_id,
        target_user_id=owner_id,
        now=await Clock.now(session=session),
    )

    # return
    return Output(
        data={**friendship.to_dict(), "result": result, "owner": owner},
        event=[],
    )
