from __future__ import annotations

from uuid import UUID

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace_invite.workspace_invite_repository import WorkspaceInviteRepository
from worship_support.api.domain.workspace_public_link.workspace_public_link_repository import WorkspacePublicLinkRepository
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
async def search(*, session, input: Input, workspace_id: UUID) -> Output:
    # find
    now = Moment.from_datetime(await Clock.now(session=session))
    emails = await WorkspaceInviteRepository.tenanted_search(
        session=session,
        workspace_id=workspace_id,
    )
    friends = await WorkspaceUserInviteRepository.tenanted_search(
        session=session,
        workspace_id=workspace_id,
    )
    people = await describe(
        session=session,
        user_ids=[invite.recipient_user_id for invite in friends],
    )
    link = await WorkspacePublicLinkRepository.tenanted_find_live(
        session=session,
        workspace_id=workspace_id,
    )

    # search
    rows = [
        {
            **invite.to_dict(),
            "state": (
                "accepted" if invite.accepted_by_user_id else ("pending" if invite.is_live(now=now) else "expired")
            ),
        }
        for invite in emails
    ] + [
        {
            **invite.to_dict(),
            "person": people.get(invite.recipient_user_id),
            "state": invite.state(now=now),
        }
        for invite in friends
    ]
    rows.sort(key=lambda row: row["created_at"] or "", reverse=True)
    latest: dict[str, dict] = {}
    for row in rows:
        key = row.get("email") or row.get("recipient_user_id")
        latest.setdefault(key, row)
    sent = [
        row for row in latest.values() if row["state"] == "pending"
    ]
    past = [
        row for row in latest.values() if row["state"] != "pending"
    ][:50]

    # return
    return Output(
        data={"sent": sent, "past": past, "link_enabled": link is not None},
        event=[],
    )
