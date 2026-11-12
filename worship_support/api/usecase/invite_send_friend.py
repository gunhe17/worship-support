from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from worship_support.api.config import get_policy_config
from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite import WorkspaceUserInvite
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock


# #
# input

class Input(CoreIn):
    user_ids: list[UUID]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def send(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
    )
    manager = await UserRepository.get_by_id(
        session=session,
        id=user_id,
    )
    friends = await FriendshipRepository.search_friend_user_ids(
        session=session,
        user_id=user_id,
    )

    # send
    sent = []
    for recipient_user_id in dict.fromkeys(input.user_ids):
        if recipient_user_id not in friends:
            raise StateError("not_friend")
        if await UserBlockRepository.verify_blocked_either_way(
            session=session,
            user_id=user_id,
            other_user_id=recipient_user_id,
        ):
            raise StateError("blocked")
        member = await WorkspaceMemberRepository.tenanted_find_by_user(
            session=session,
            workspace_id=workspace_id,
            user_id=recipient_user_id,
        )
        if member is not None and member.is_active():
            raise StateError("already_member")
        for live in await WorkspaceUserInviteRepository.tenanted_search_live_for_user(
            session=session,
            workspace_id=workspace_id,
            user_id=recipient_user_id,
            now=now,
        ):
            await WorkspaceUserInviteRepository.tenanted_update(
                session=session,
                entity=live.expire(at=Moment.from_datetime(now)),
            )
        invite = await WorkspaceUserInviteRepository.add(
            session=session,
            entity=WorkspaceUserInvite.new(
                workspace_id=workspace_id,
                recipient_user_id=recipient_user_id,
                expires_at=Moment.from_datetime(now + timedelta(days=get_policy_config().INVITE_DAYS)),
            ),
        )
        await NotificationRepository.add(
            session=session,
            entity=Notification.workspace_invite(
                recipient_user_id=recipient_user_id,
                actor_user_id=user_id,
                actor_name=manager.name.to_str(),
                workspace_name=workspace.name.to_str(),
                invite_id=invite.id,
            ),
        )
        sent.append(invite.to_dict())

    # return
    return Output(
        data=sent,
        event=[],
    )
