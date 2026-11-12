from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.user.user_repository import UserRepository


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
async def get(*, session, input: Input, user_id: UUID) -> Output:
    # find
    user = await UserRepository.get_by_id(
        session=session,
        id=user_id,
    )
    socials = await UserRepository.search_social_accounts(
        session=session,
        user_id=user_id,
    )

    # return
    return Output(
        data={
            **user.to_dict(),
            "email": next(
                (social.provider_email.to_str() for social in socials if social.provider_email), None
            ),
            "social_accounts": [
                social.to_dict() for social in socials
            ],
        },
        event=[],
    )
