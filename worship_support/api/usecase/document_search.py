from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.document.document_repository import DocumentRepository
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
async def search(*, session, input: Input, workspace_id: UUID, member_id: UUID) -> Output:
    # find
    member = await WorkspaceMemberRepository.tenanted_get_active_by_id(
        session=session,
        workspace_id=workspace_id,
        id=member_id,
    )

    # return
    return Output(
        data=await DocumentRepository.tenanted_search_visible(
            session=session,
            workspace_id=workspace_id,
            member_id=member_id,
            manager=member.is_manager(),
        ),
        event=[],
    )
