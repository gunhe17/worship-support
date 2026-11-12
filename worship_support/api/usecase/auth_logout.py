from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.login_session.login_session_repository import LoginSessionRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock


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
async def logout(*, session, input: Input, user_id: UUID, login_session_id: UUID) -> Output:
    # find
    found = await LoginSessionRepository.get_by_id_and_user(
        session=session,
        id=login_session_id,
        user_id=user_id,
    )

    # persist
    await LoginSessionRepository.update(
        session=session,
        entity=found.revoke(at=Moment.from_datetime(await Clock.now(session=session))),
    )

    # return
    return Output(
        data={},
        event=[],
    )
