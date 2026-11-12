from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.friend_link.friend_link_repository import FriendLinkRepository
from worship_support.api.domain.friendship.friendship_repository import FriendshipRepository
from worship_support.api.domain.login_session.login_session_repository import LoginSessionRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.user_block.user_block_repository import UserBlockRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase import workspace_close


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
async def withdraw(*, session, input: Input, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    await UserRepository.lock(
        session=session,
        ids=[user_id],
    )
    user = await UserRepository.get_active_by_id(
        session=session,
        id=user_id,
    )
    memberships = await WorkspaceMemberRepository.search_active_by_user(
        session=session,
        user_id=user_id,
    )
    for membership in memberships:
        if membership.is_manager() and await WorkspaceMemberRepository.tenanted_count_active(
            session=session,
            workspace_id=membership.workspace_id,
        ) > 1:
            raise StateError("manager_must_transfer")

    # withdraw
    for membership in memberships:
        if membership.is_manager():
            workspace = await WorkspaceRepository.get_open_by_id(
                session=session,
                id=membership.workspace_id,
            )
            await workspace_close.close(
                session=session,
                input=workspace_close.Input(confirm_name=workspace.name.to_str()),
                workspace_id=membership.workspace_id,
                user_id=user_id,
            )
        await WorkspaceMemberRepository.tenanted_update(
            session=session,
            entity=membership.leave(),
        )
    await FriendshipRepository.end_all_for_user(
        session=session,
        user_id=user_id,
        now=now,
    )
    await UserBlockRepository.end_all_for_user(
        session=session,
        user_id=user_id,
        now=now,
    )
    await FriendLinkRepository.end_all_for_user(
        session=session,
        user_id=user_id,
        now=now,
    )
    await UserRepository.unlink_all_social_accounts(
        session=session,
        user_id=user_id,
        now=now,
    )
    await LoginSessionRepository.revoke_all_for_user(
        session=session,
        user_id=user_id,
        now=now,
    )

    # persist
    withdrawn = await UserRepository.withdraw(
        session=session,
        entity=user.withdraw(),
    )

    # return
    return Output(
        data=withdrawn.to_dict(),
        event=[],
    )
