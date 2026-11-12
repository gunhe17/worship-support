from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.workspace.name import Name
from worship_support.api.domain.workspace.workspace import Workspace
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.role import Role
from worship_support.api.domain.workspace_member.workspace_member import WorkspaceMember
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository


# #
# input

class Input(CoreIn):
    name: str


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def create(*, session, input: Input, user_id: UUID) -> Output:
    # find
    name = Name.from_str(input.name)
    await UserRepository.lock(
        session=session,
        ids=[user_id],
    )
    await WorkspaceRepository.ensure_name_free_for_user(
        session=session,
        name=name,
        user_id=user_id,
    )

    # create
    workspace = await WorkspaceRepository.add(
        session=session,
        entity=Workspace.new(name=name),
    )
    member = await WorkspaceMemberRepository.add(
        session=session,
        entity=WorkspaceMember.new(
            workspace_id=workspace.id,
            user_id=user_id,
            role=Role.from_str("MANAGER"),
        ),
    )

    # return
    return Output(
        data={**workspace.to_dict(), "role": member.role.to_str(), "member_count": 1},
        event=[],
    )
