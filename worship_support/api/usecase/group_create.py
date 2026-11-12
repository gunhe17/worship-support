from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_group.name import Name
from worship_support.api.domain.workspace_group.workspace_group import WorkspaceGroup
from worship_support.api.domain.workspace_group.workspace_group_repository import WorkspaceGroupRepository


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
async def create(*, session, input: Input, workspace_id: UUID) -> Output:
    # create
    group = await WorkspaceGroupRepository.tenanted_add_unique_by_name(
        session=session,
        entity=WorkspaceGroup.new(
            workspace_id=workspace_id,
            name=Name.from_str(input.name),
        ),
    )

    # return
    return Output(
        data={**group.to_dict(), "member_count": 0},
        event=[],
    )
