from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_public_link.workspace_public_link_repository import WorkspacePublicLinkRepository
from worship_support.api.usecase.join_preview import preview
from worship_support.api.usecase.secret import token_hash


# #
# input

class Input(CoreIn):
    token: str


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def check(*, session, input: Input, user_id: UUID) -> Output:
    # find
    link = await WorkspacePublicLinkRepository.find_by_token_hash(
        session=session,
        token_hash=token_hash(value=input.token),
    )
    if link is None or link.expires_at is not None:
        raise StateError("link_unusable")
    workspace = await WorkspaceRepository.find_by_id(
        session=session,
        id=link.workspace_id,
    )
    if workspace is None or workspace.is_closed():
        raise StateError("link_unusable")
    previewed = await preview(
        session=session,
        workspace=workspace,
        user_id=user_id,
    )
    if previewed["removed"]:
        raise StateError("removed_member")

    # return
    return Output(
        data=previewed,
        event=[],
    )
