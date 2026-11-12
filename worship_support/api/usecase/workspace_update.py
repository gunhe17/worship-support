from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace.name import Name
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository


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
async def update(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    name = Name.from_str(input.name)
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
        lock=True,
    )
    await WorkspaceRepository.ensure_name_free_for_user(
        session=session,
        name=name,
        user_id=user_id,
        exclude_id=workspace_id,
    )

    # persist
    updated = await WorkspaceRepository.update(
        session=session,
        entity=workspace.with_name(name),
    )

    # return
    return Output(
        data=updated.to_dict(),
        event=[],
    )
