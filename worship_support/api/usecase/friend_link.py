from __future__ import annotations

from typing import Literal
from uuid import UUID, uuid4

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friend_link.friend_link import FriendLink
from worship_support.api.domain.friend_link.friend_link_repository import FriendLinkRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.secret import link_token, token_hash


# #
# input

class Input(CoreIn):
    mode: Literal["get", "replace"] = "get"


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def get(*, session, input: Input, user_id: UUID) -> Output:
    # find
    link = await FriendLinkRepository.find_live_for_user(
        session=session,
        user_id=user_id,
    )

    # replace
    if link is not None and input.mode == "replace":
        await FriendLinkRepository.disable(
            session=session,
            entity=link.disable(at=Moment.from_datetime(await Clock.now(session=session))),
        )
        link = None
    if link is None:
        id = uuid4()
        link = await FriendLinkRepository.add(
            session=session,
            entity=FriendLink.new(
                id=id,
                user_id=user_id,
                token_hash=token_hash(value=link_token(kind="user_friend_link", id=id)),
            ),
        )

    # return
    return Output(
        data={"token": link_token(kind="user_friend_link", id=link.id)},
        event=[],
    )
