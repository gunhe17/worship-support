from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.notification.notification_repository import NotificationRepository
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
async def read(*, session, input: Input, user_id: UUID) -> Output:
    # persist
    await NotificationRepository.read_all_for_user(
        session=session,
        user_id=user_id,
        now=await Clock.now(session=session),
    )

    # return
    return Output(
        data={},
        event=[],
    )
