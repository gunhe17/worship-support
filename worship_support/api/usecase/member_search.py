from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.usecase.person import describe


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
async def search(*, session, input: Input, workspace_id: UUID, user_id: UUID) -> Output:
    # find
    members = await WorkspaceMemberRepository.tenanted_search_active(
        session=session,
        workspace_id=workspace_id,
    )
    people = await describe(
        session=session,
        user_ids=[member.user_id for member in members],
    )
    relations = {
        friendship.friend_user_id: friendship.state()
        for friendship in await FriendshipRepository.search_live_for_user(
            session=session,
            user_id=user_id,
        )
    }
    blocked = await UserBlockRepository.search_blocked_either_way(
        session=session,
        user_id=user_id,
    )

    # search
    rows = [
        {
            **member.to_dict(),
            "person": people.get(member.user_id),
            "me": member.user_id == user_id,
            "relation": (
                "blocked" if member.user_id in blocked else relations.get(member.user_id, "none")
            ),
        }
        for member in members
    ]
    rows.sort(key=lambda row: (row["role"] != "MANAGER", not row["me"]))

    # return
    return Output(
        data=rows,
        event=[],
    )
