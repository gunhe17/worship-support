from __future__ import annotations

from uuid import UUID

from worship_support.api.domain.workspace.workspace import Workspace
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.usecase.person import describe


# #
# preview

async def preview(*, session, workspace: Workspace, user_id: UUID) -> dict:
    manager = await WorkspaceMemberRepository.tenanted_get_manager(
        session=session,
        workspace_id=workspace.id,
    )
    me = await WorkspaceMemberRepository.tenanted_find_by_user(
        session=session,
        workspace_id=workspace.id,
        user_id=user_id,
    )
    count = await WorkspaceMemberRepository.tenanted_count_active(
        session=session,
        workspace_id=workspace.id,
    )
    people = await describe(
        session=session,
        user_ids=[manager.user_id],
    )
    return {
        **workspace.to_dict(),
        "manager": people.get(manager.user_id),
        "member_count": count,
        "already_member": me is not None and me.is_active(),
        "removed": me is not None and me.status.is_("REMOVED"),
    }
