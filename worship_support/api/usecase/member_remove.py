from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository


# #
# input

class Input(CoreIn):
    member_id: UUID


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def remove(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
        lock=True,
    )
    target = await WorkspaceMemberRepository.tenanted_get_active_by_id(
        session=session,
        workspace_id=workspace_id,
        id=input.member_id,
        lock=True,
    )
    if target.is_manager() or target.user_id == user_id:
        raise StateError("manager_must_transfer")

    # remove
    removed = await WorkspaceMemberRepository.tenanted_update(
        session=session,
        entity=target.remove(),
    )

    # persist
    await NotificationRepository.add(
        session=session,
        entity=Notification.member_removed(
            recipient_user_id=target.user_id,
            workspace_name=workspace.name.to_str(),
            workspace_id=workspace_id,
        ),
    )

    # return
    return Output(
        data=removed.to_dict(),
        event=[],
    )
