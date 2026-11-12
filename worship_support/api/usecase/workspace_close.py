from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.domain.workspace_public_link.workspace_public_link_repository import WorkspacePublicLinkRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock


# #
# input

class Input(CoreIn):
    confirm_name: str


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def close(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
        lock=True,
    )
    if input.confirm_name.strip() != workspace.name.to_str():
        raise StateError("workspace_name_mismatch")
    members = await WorkspaceMemberRepository.tenanted_search_active(
        session=session,
        workspace_id=workspace_id,
    )

    # close
    closed = await WorkspaceRepository.update(
        session=session,
        entity=workspace.close(at=Moment.from_datetime(now)),
    )
    await WorkspaceInviteRepository.tenanted_expire_live(
        session=session,
        workspace_id=workspace_id,
        now=now,
    )
    await WorkspaceUserInviteRepository.tenanted_expire_live(
        session=session,
        workspace_id=workspace_id,
        now=now,
    )
    await WorkspacePublicLinkRepository.tenanted_expire_live(
        session=session,
        workspace_id=workspace_id,
        now=now,
    )

    # persist
    for member in members:
        if member.user_id == user_id:
            continue
        await NotificationRepository.add(
            session=session,
            entity=Notification.workspace_closed(
                recipient_user_id=member.user_id,
                workspace_name=workspace.name.to_str(),
                workspace_id=workspace_id,
            ),
        )

    # return
    return Output(
        data=closed.to_dict(),
        event=[],
    )
