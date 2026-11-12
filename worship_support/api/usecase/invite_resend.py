from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.usecase import invite_send_email
from worship_support.api.usecase import invite_send_friend


# #
# input

class Input(CoreIn):
    kind: Literal["email", "friend"]
    id: UUID


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def resend(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    if input.kind == "email":
        invite = await WorkspaceInviteRepository.tenanted_get_by_id(
            session=session,
            workspace_id=workspace_id,
            id=input.id,
        )
        sent = await invite_send_email.send(
            session=session,
            input=invite_send_email.Input(emails=[invite.recipient_email.to_str()]),
            workspace_id=workspace_id,
            user_id=user_id,
        )
    else:
        invite = await WorkspaceUserInviteRepository.tenanted_get_by_id(
            session=session,
            workspace_id=workspace_id,
            id=input.id,
        )
        sent = await invite_send_friend.send(
            session=session,
            input=invite_send_friend.Input(user_ids=[invite.recipient_user_id]),
            workspace_id=workspace_id,
            user_id=user_id,
        )

    # return
    return Output(
        data=sent.data,
        event=[],
    )
