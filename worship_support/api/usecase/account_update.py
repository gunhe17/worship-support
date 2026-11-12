from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.user.name import Name
from worship_support.api.domain.user.user_repository import UserRepository


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
async def update(*, session, input: Input, user_id: UUID) -> Output:
    # find
    user = await UserRepository.get_active_by_id(
        session=session,
        id=user_id,
    )

    # persist
    updated = await UserRepository.update(
        session=session,
        entity=user.with_name(Name.from_str(input.name)),
    )

    # return
    return Output(
        data=updated.to_dict(),
        event=[],
    )
