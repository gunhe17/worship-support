from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.document.document_repository import DocumentRepository


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
async def create(*, session, input: Input, workspace_id: UUID, member_id: UUID) -> Output:
    # create
    document = await DocumentRepository.tenanted_create(
        session=session,
        workspace_id=workspace_id,
        member_id=member_id,
        name=input.name,
    )

    # return
    return Output(
        data=document,
        event=[],
    )
