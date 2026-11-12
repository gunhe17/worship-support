from __future__ import annotations

from uuid import UUID

from worship_support.api.domain.user.user_repository import UserRepository


# #
# describe

async def describe(*, session, user_ids: list[UUID]) -> dict[UUID, dict]:
    unique = list(dict.fromkeys(user_ids))
    users = await UserRepository.find_by_ids(
        session=session,
        ids=unique,
    )
    emails = await UserRepository.search_display_emails(
        session=session,
        user_ids=unique,
    )
    return {
        user.id: {
            "id": str(user.id),
            "name": (
                user.name.to_str() if user.name else "탈퇴한 사용자"
            ),
            "email": emails.get(user.id),
        }
        for user in users
    }
