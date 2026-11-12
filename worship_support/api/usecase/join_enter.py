from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

import sqlalchemy as sa

from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.workspace.workspace import Workspace
from worship_support.api.domain.workspace_group.group_member.group_member_model import GroupMemberModel
from worship_support.api.domain.workspace_member.role import Role
from worship_support.api.domain.workspace_member.workspace_member import WorkspaceMember
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.usecase.person import describe


# #
# enter

async def enter(
    *,
    session,
    workspace: Workspace,
    user_id: UUID,
    path: Literal["code", "link", "invite"],
    now: datetime,
) -> tuple[WorkspaceMember, bool]:
    # find
    await UserRepository.lock(
        session=session,
        ids=[user_id],
    )
    user = await UserRepository.get_active_by_id(
        session=session,
        id=user_id,
    )
    member = await WorkspaceMemberRepository.tenanted_find_by_user(
        session=session,
        workspace_id=workspace.id,
        user_id=user_id,
        lock=True,
    )
    if member is not None and member.is_active():
        return member, True
    if member is not None and member.status.is_("REMOVED") and path == "link":
        raise StateError("removed_member")
    manager = await WorkspaceMemberRepository.tenanted_get_manager(
        session=session,
        workspace_id=workspace.id,
    )

    # enter
    returned = member is not None and member.status.is_("REMOVED")
    if member is None:
        entered = await WorkspaceMemberRepository.add(
            session=session,
            entity=WorkspaceMember.new(
                workspace_id=workspace.id,
                user_id=user_id,
                role=Role.from_str("MEMBER"),
            ),
        )
    else:
        entered = await WorkspaceMemberRepository.tenanted_update(
            session=session,
            entity=member.rejoin(),
        )
    if returned:
        await session.execute(
            sa.update(GroupMemberModel)
            .where(
                GroupMemberModel.member_id == entered.id,
                GroupMemberModel.removed_at.is_(None),
            )
            .values(removed_at=now)
        )
        await session.execute(
            sa.text("UPDATE document_grant SET revoked_at = :now WHERE member_id = :m AND revoked_at IS NULL"),
            {"now": now, "m": entered.id},
        )

    # notify
    name = (await describe(session=session, user_ids=[user.id]))[user.id]["name"]
    template = Notification.member_returned if returned else Notification.member_joined
    await NotificationRepository.add(
        session=session,
        entity=template(
            recipient_user_id=manager.user_id,
            actor_user_id=user_id,
            actor_name=name,
            workspace_name=workspace.name.to_str(),
            member_id=entered.id,
        ),
    )

    return entered, False
