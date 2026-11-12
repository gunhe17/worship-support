from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
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
async def get(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
    )
    me = await WorkspaceMemberRepository.tenanted_get_active_by_user(
        session=session,
        workspace_id=workspace_id,
        user_id=user_id,
    )
    manager = await WorkspaceMemberRepository.tenanted_get_manager(
        session=session,
        workspace_id=workspace_id,
    )
    count = await WorkspaceMemberRepository.tenanted_count_active(
        session=session,
        workspace_id=workspace_id,
    )
    people = await describe(
        session=session,
        user_ids=[manager.user_id],
    )

    # return
    return Output(
        data={
            **workspace.to_dict(),
            "role": me.role.to_str(),
            "member_id": str(me.id),
            "member_count": count,
            "manager": people.get(manager.user_id),
        },
        event=[],
    )
