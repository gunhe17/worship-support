from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_group.workspace_group_repository import WorkspaceGroupRepository


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
async def search(*, session, input: Input, workspace_id: UUID) -> Output:
    # find
    groups = await WorkspaceGroupRepository.tenanted_search(
        session=session,
        workspace_id=workspace_id,
    )
    counts = await WorkspaceGroupRepository.tenanted_search_member_counts(
        session=session,
        workspace_id=workspace_id,
    )

    # return
    return Output(
        data=[
            {**group.to_dict(), "member_count": counts.get(group.id, 0)} for group in groups
        ],
        event=[],
    )
