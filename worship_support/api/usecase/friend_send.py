from __future__ import annotations

from datetime import datetime
from uuid import UUID

from worship_support.api.config import get_policy_config
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship import Friendship
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.usecase.person import describe


# #
# send

async def send(*, session, user_id: UUID, target_user_id: UUID, now: datetime) -> tuple[Friendship, str]:
    # find
    if user_id == target_user_id:
        raise StateError("friend_self")
    await UserRepository.lock(
        session=session,
        ids=[user_id, target_user_id],
    )
    await UserRepository.get_active_by_id(
        session=session,
        id=target_user_id,
    )
    if await UserBlockRepository.verify_blocked_either_way(
        session=session,
        user_id=user_id,
        other_user_id=target_user_id,
    ):
        raise StateError("blocked")
    live = await FriendshipRepository.find_live_between(
        session=session,
        user_id=user_id,
        other_user_id=target_user_id,
    )
    people = await describe(
        session=session,
        user_ids=[user_id, target_user_id],
    )

    # accept crossing request
    if live is not None and live.is_received_request():
        accepted = await FriendshipRepository.update_pair(
            session=session,
            entity=live.accept(at=Moment.from_datetime(now)),
        )
        await NotificationRepository.add(
            session=session,
            entity=Notification.friend_accepted(
                recipient_user_id=target_user_id,
                actor_user_id=user_id,
                actor_name=people[user_id]["name"],
                pair_id=accepted.pair_id,
            ),
        )
        return accepted, "accepted"
    if live is not None:
        raise StateError("friend_exists")

    # quota
    policy = get_policy_config()
    if await FriendshipRepository.count_pending_sent(session=session, user_id=user_id) >= policy.FRIEND_PENDING_LIMIT:
        raise StateError("friend_quota", {"limit": policy.FRIEND_PENDING_LIMIT})
    if await FriendshipRepository.count_sent_since(session=session, user_id=user_id, now=now) >= policy.FRIEND_DAILY_LIMIT:
        raise StateError("friend_quota", {"limit": policy.FRIEND_DAILY_LIMIT})

    # request
    sent = await FriendshipRepository.add_pair(
        session=session,
        pair=Friendship.new_pair(
            requester_user_id=user_id,
            recipient_user_id=target_user_id,
        ),
    )
    await NotificationRepository.add(
        session=session,
        entity=Notification.friend_request(
            recipient_user_id=target_user_id,
            actor_user_id=user_id,
            actor_name=people[user_id]["name"],
            pair_id=sent.pair_id,
        ),
    )
    return sent, "requested"
