from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from worship_support.api.config import get_policy_config
from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_invite.workspace_invite import WorkspaceInvite
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.infrastructure.mail.console.client import mail
from worship_support.api.infrastructure.token.secrets.client import token
from worship_support.api.usecase.secret import code_hash


# #
# input

class Input(CoreIn):
    emails: list[str]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def send(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=workspace_id,
    )
    manager = await UserRepository.get_by_id(
        session=session,
        id=user_id,
    )
    emails = list(
        dict.fromkeys(Email.from_str(email) for email in input.emails)
    )

    # send
    sent = []
    for email in emails:
        for live in await WorkspaceInviteRepository.tenanted_search_live_by_email(
            session=session,
            workspace_id=workspace_id,
            email=email,
            now=now,
        ):
            await WorkspaceInviteRepository.tenanted_update(
                session=session,
                entity=live.expire(at=Moment.from_datetime(now)),
            )
        code = token.generate_code()
        while await WorkspaceInviteRepository.exists_live_by_code_hash(
            session=session,
            code_hash=code_hash(code=code),
            now=now,
        ):
            code = token.generate_code()
        invite = await WorkspaceInviteRepository.add(
            session=session,
            entity=WorkspaceInvite.new(
                workspace_id=workspace_id,
                recipient_email=email,
                code_hash=code_hash(code=code),
                expires_at=Moment.from_datetime(now + timedelta(days=get_policy_config().INVITE_DAYS)),
            ),
        )
        mail.send(
            to=email.to_str(),
            subject=f"{workspace.name.to_str()} 공간 초대",
            body=f"{manager.name.to_str()}님이 {workspace.name.to_str()} 공간에 초대했어요. 초대 코드: {code}",
        )
        sent.append(invite.to_dict())

    # return
    return Output(
        data=sent,
        event=[],
    )
