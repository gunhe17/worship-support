from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository


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
async def leave(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
        lock=True,
    )
    member = await WorkspaceMemberRepository.tenanted_find_by_user(
        session=session,
        workspace_id=workspace_id,
        user_id=user_id,
        lock=True,
    )
    if member is None or not member.is_active():
        raise StateError("member_not_active")
    if member.is_manager():
        raise StateError("manager_must_transfer")
    manager = await WorkspaceMemberRepository.tenanted_get_manager(
        session=session,
        workspace_id=workspace_id,
    )
    actor = await UserRepository.get_by_id(
        session=session,
        id=user_id,
    )

    # leave
    left = await WorkspaceMemberRepository.tenanted_update(
        session=session,
        entity=member.leave(),
    )

    # persist
    await NotificationRepository.add(
        session=session,
        entity=Notification.member_left(
            recipient_user_id=manager.user_id,
            actor_user_id=user_id,
            actor_name=actor.name.to_str(),
            workspace_name=workspace.name.to_str(),
            member_id=member.id,
        ),
    )

    # return
    return Output(
        data=left.to_dict(),
        event=[],
    )
