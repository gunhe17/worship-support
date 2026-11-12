from __future__ import annotations

from uuid import UUID, uuid4

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_public_link.workspace_public_link import WorkspacePublicLink
from worship_support.api.domain.workspace_public_link.workspace_public_link_repository import WorkspacePublicLinkRepository
from worship_support.api.usecase.secret import link_token, token_hash


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
async def get(*, session, input: Input, workspace_id: UUID) -> Output:
    # find
    link = await WorkspacePublicLinkRepository.tenanted_find_live(
        session=session,
        workspace_id=workspace_id,
        lock=True,
    )

    # get
    created = link is None
    if link is None:
        id = uuid4()
        link = await WorkspacePublicLinkRepository.add(
            session=session,
            entity=WorkspacePublicLink.new(
                id=id,
                workspace_id=workspace_id,
                token_hash=token_hash(value=link_token(kind="workspace_public_link", id=id)),
            ),
        )

    # return
    return Output(
        data={
            **link.to_dict(),
            "token": link_token(kind="workspace_public_link", id=link.id),
            "created": created,
        },
        event=[],
    )
