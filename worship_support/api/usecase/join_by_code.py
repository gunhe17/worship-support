from __future__ import annotations

import re
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import InvalidFormatError, StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.join_enter import enter
from worship_support.api.usecase.secret import code_hash


# #
# input

class Input(CoreIn):
    code: str


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def join(*, session, input: Input, user_id: UUID) -> Output:
    # find
    if not re.fullmatch(r"\d{6}", input.code.strip()):
        raise InvalidFormatError("초대 코드")
    now = await Clock.now(session=session)
    invite = await WorkspaceInviteRepository.find_live_by_code_hash(
        session=session,
        code_hash=code_hash(code=input.code.strip()),
        now=now,
        lock=True,
    )
    if invite is None:
        raise StateError("code_mismatch")
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=invite.workspace_id,
        lock=True,
    )

    # join
    member, already = await enter(
        session=session,
        workspace=workspace,
        user_id=user_id,
        path="code",
        now=now,
    )

    # persist
    await WorkspaceInviteRepository.tenanted_update(
        session=session,
        entity=(
            invite.expire(at=Moment.from_datetime(now)) if already else invite.accept(user_id=user_id, at=Moment.from_datetime(now))
        ),
    )

    # return
    return Output(
        data={"workspace": workspace.to_dict(), "already_member": already},
        event=[],
    )
