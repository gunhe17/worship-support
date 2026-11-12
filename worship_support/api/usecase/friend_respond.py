from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import NotFoundError, StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.person import describe


# #
# input

class Input(CoreIn):
    pair_id: UUID
    action: Literal["accept", "end"]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def respond(*, session, input: Input, user_id: UUID) -> Output:
    # find
    now = Moment.from_datetime(await Clock.now(session=session))
    peek = await FriendshipRepository.find_by_pair_for_user(
        session=session,
        pair_id=input.pair_id,
        user_id=user_id,
    )
    if peek is None:
        raise NotFoundError("친구 요청", str(input.pair_id))
    await UserRepository.lock(
        session=session,
        ids=[user_id, peek.friend_user_id],
    )
    mine = await FriendshipRepository.get_live_by_pair_for_user(
        session=session,
        pair_id=input.pair_id,
        user_id=user_id,
    )
    if mine.ended_at is not None:
        raise StateError("friend_request_closed")

    # respond
    if input.action == "accept":
        if not mine.is_received_request():
            raise StateError("friend_request_closed")
        updated = await FriendshipRepository.update_pair(
            session=session,
            entity=mine.accept(at=now),
        )
        people = await describe(
            session=session,
            user_ids=[user_id],
        )
        await NotificationRepository.add(
            session=session,
            entity=Notification.friend_accepted(
                recipient_user_id=mine.friend_user_id,
                actor_user_id=user_id,
                actor_name=people[user_id]["name"],
                pair_id=mine.pair_id,
            ),
        )
    else:
        updated = await FriendshipRepository.update_pair(
            session=session,
            entity=mine.end(at=now),
        )

    # return
    return Output(
        data=updated.to_dict(),
        event=[],
    )
