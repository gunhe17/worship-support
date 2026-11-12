from __future__ import annotations

from uuid import UUID

from worship_support.api.config import get_policy_config
from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
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
async def search(*, session, input: Input, user_id: UUID, login_session_id: UUID) -> Output:
    # find
    sessions = await LoginSessionRepository.search_valid_by_user(
        session=session,
        user_id=user_id,
        now=await Clock.now(session=session),
        days=get_policy_config().SESSION_DAYS,
    )

    # return
    return Output(
        data=[
            {**found.to_dict(), "current": found.id == login_session_id} for found in sessions
        ],
        event=[],
    )
