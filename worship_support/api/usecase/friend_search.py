from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
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
async def search(*, session, input: Input, user_id: UUID) -> Output:
    # find
    live = await FriendshipRepository.search_live_for_user(
        session=session,
        user_id=user_id,
    )
    blocks = await UserBlockRepository.search_live_for_user(
        session=session,
        user_id=user_id,
    )
    people = await describe(
        session=session,
        user_ids=[friendship.friend_user_id for friendship in live] + [block.blocked_user_id for block in blocks],
    )
    friend_ids = [
        friendship.friend_user_id for friendship in live if friendship.is_friend()
    ]
    shared = await WorkspaceMemberRepository.search_shared_workspace_ids(
        session=session,
        user_id=user_id,
        other_user_ids=friend_ids,
    )
    workspaces = {
        workspace.id: workspace
        for workspace in await WorkspaceRepository.find_by_ids(
            session=session,
            ids=list({id for ids in shared.values() for id in ids}),
        )
    }

    # search
    def row(friendship):
        return {
            **friendship.to_dict(),
            "person": people.get(friendship.friend_user_id),
        }

    friends = [
        {
            **row(friendship),
            "shared_spaces": [
                workspaces[id].to_dict()
                for id in shared.get(friendship.friend_user_id, [])
                if id in workspaces and not workspaces[id].is_closed()
            ],
        }
        for friendship in live
        if friendship.is_friend()
    ]
    friends.sort(key=lambda item: item["person"]["name"] if item["person"] else "")

    # return
    return Output(
        data={
            "friends": friends,
            "received": [row(friendship) for friendship in live if friendship.is_received_request()],
            "sent": [row(friendship) for friendship in live if friendship.is_sent_request()],
            "blocked": [
                {**block.to_dict(), "person": people.get(block.blocked_user_id)} for block in blocks
            ],
        },
        event=[],
    )
