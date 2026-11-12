from __future__ import annotations

from uuid import UUID

from worship_support.api.config import get_policy_config
from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.person import describe


# #
# input

class Input(CoreIn):
    pass


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def search(*, session, input: Input, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    notifications = await NotificationRepository.search_recent_for_user(
        session=session,
        user_id=user_id,
        now=now,
        days=get_policy_config().NOTIFICATION_DAYS,
    )
    people = await describe(
        session=session,
        user_ids=[notification.actor_user_id for notification in notifications if notification.actor_user_id],
    )

    # state
    rows = []
    for notification in notifications:
        state = None
        if notification.kind.is_("FRIEND_REQUEST"):
            friendship = await FriendshipRepository.find_by_pair_for_user(
                session=session,
                pair_id=notification.target_id,
                user_id=user_id,
            )
            state = (
                "pending" if friendship is not None and friendship.is_received_request() else (
                    "accepted" if friendship is not None and friendship.accepted_at is not None else "closed"
                )
            )
        elif notification.kind.is_("WORKSPACE_INVITE"):
            invite = await WorkspaceUserInviteRepository.find_by_id(
                session=session,
                id=notification.target_id,
            )
            state = invite.state(now=Moment.from_datetime(now)) if invite else "expired"
        rows.append(
            {
                **notification.to_dict(),
                "actor": people.get(notification.actor_user_id),
                "action_state": state,
            }
        )

    # return
    return Output(
        data={
            "items": rows,
            "unread": sum(1 for row in rows if not row["read"]),
            "needs_response": sum(1 for row in rows if row["action_state"] == "pending"),
            "needs_response_friend": sum(
                1 for row in rows if row["action_state"] == "pending" and row["kind"] == "FRIEND_REQUEST"
            ),
        },
        event=[],
    )
