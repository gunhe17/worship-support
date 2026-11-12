from __future__ import annotations

from typing import Literal
from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.notification_repository import NotificationRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
from worship_support.api.usecase.join_enter import enter
from worship_support.api.usecase.person import describe


# #
# input

class Input(CoreIn):
    id: UUID
    answer: Literal["accept", "decline"]


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def answer(*, session, input: Input, user_id: UUID) -> Output:
    # find
    now = await Clock.now(session=session)
    invite = await WorkspaceUserInviteRepository.get_by_id_for_recipient(
        session=session,
        id=input.id,
        user_id=user_id,
    )
    if not invite.is_live(now=Moment.from_datetime(now)):
        raise StateError("invite_closed")
    workspace = await WorkspaceRepository.get_open_by_id(
        session=session,
        id=invite.workspace_id,
        lock=True,
    )

    # answer
    already = False
    if input.answer == "accept":
        member, already = await enter(
            session=session,
            workspace=workspace,
            user_id=user_id,
            path="invite",
            now=now,
        )
        answered = invite.expire(at=Moment.from_datetime(now)) if already else invite.accept(at=Moment.from_datetime(now))
    else:
        answered = invite.decline(at=Moment.from_datetime(now))
        manager = await WorkspaceMemberRepository.tenanted_get_manager(
            session=session,
            workspace_id=workspace.id,
        )
        people = await describe(
            session=session,
            user_ids=[user_id],
        )
        await NotificationRepository.add(
            session=session,
            entity=Notification.workspace_invite_declined(
                recipient_user_id=manager.user_id,
                actor_user_id=user_id,
                actor_name=people[user_id]["name"],
                workspace_name=workspace.name.to_str(),
                invite_id=invite.id,
            ),
        )

    # persist
    saved = await WorkspaceUserInviteRepository.tenanted_update(
        session=session,
        entity=answered,
    )

    # return
    return Output(
        data={
            "invite": saved.to_dict(),
            "workspace": workspace.to_dict(),
            "already_member": already,
        },
        event=[],
    )
