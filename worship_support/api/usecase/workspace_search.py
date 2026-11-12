from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.domain.workspace_user_invite.workspace_user_invite_repository import WorkspaceUserInviteRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock
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
    now = await Clock.now(session=session)
    memberships = await WorkspaceMemberRepository.search_active_by_user(
        session=session,
        user_id=user_id,
    )
    received = [
        invite
        for invite in await WorkspaceUserInviteRepository.search_live_for_recipient(
            session=session,
            user_id=user_id,
            now=now,
        )
        if invite.workspace_id not in {membership.workspace_id for membership in memberships}
    ]
    workspace_ids = list(
        dict.fromkeys([membership.workspace_id for membership in memberships] + [invite.workspace_id for invite in received])
    )
    workspaces = {
        workspace.id: workspace
        for workspace in await WorkspaceRepository.find_by_ids(
            session=session,
            ids=workspace_ids,
        )
    }
    counts = await WorkspaceMemberRepository.search_active_counts(
        session=session,
        workspace_ids=workspace_ids,
    )
    managers = await WorkspaceMemberRepository.search_managers(
        session=session,
        workspace_ids=workspace_ids,
    )
    people = await describe(
        session=session,
        user_ids=list(managers.values()),
    )

    # search
    spaces = []
    for membership in memberships:
        workspace = workspaces[membership.workspace_id]
        waiting = 0
        if membership.is_manager():
            waiting = await WorkspaceInviteRepository.tenanted_count_live(
                session=session,
                workspace_id=workspace.id,
                now=now,
            ) + await WorkspaceUserInviteRepository.tenanted_count_live(
                session=session,
                workspace_id=workspace.id,
                now=now,
            )
        spaces.append(
            {
                **workspace.to_dict(),
                "role": membership.role.to_str(),
                "member_count": counts.get(workspace.id, 0),
                "manager": people.get(managers.get(workspace.id)),
                "waiting_invites": waiting,
            }
        )
    invites = [
        {
            "id": str(invite.id),
            "expires_at": invite.expires_at.to_str(),
            "workspace": {
                **workspaces[invite.workspace_id].to_dict(),
                "member_count": counts.get(invite.workspace_id, 0),
                "manager": people.get(managers.get(invite.workspace_id)),
            },
        }
        for invite in received
        if not workspaces[invite.workspace_id].is_closed()
    ]

    # return
    return Output(
        data={"spaces": spaces, "received_invites": invites},
        event=[],
    )
