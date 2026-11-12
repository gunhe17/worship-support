from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.exception import ForbiddenError, NotFoundError
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository


# #
# input

class Input(CoreIn):
    member_id: UUID


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def restore(*, session, input: Input, user_id: UUID) -> Output:
    # find
    target = await WorkspaceMemberRepository.find_by_id(session=session, id=input.member_id)
    if target is None or not target.is_active():
        raise NotFoundError("구성원", str(input.member_id))
    manager = await WorkspaceMemberRepository.tenanted_get_manager(session=session, workspace_id=target.workspace_id)
    if manager.user_id != user_id:
        raise ForbiddenError("이전 권한 되살리기")
    at = target.updated_at

    # restore
    groups = await session.execute(
        sa.text(
            """
            INSERT INTO workspace_group_member (workspace_id, group_id, member_id)
            SELECT gm.workspace_id, gm.group_id, gm.member_id FROM workspace_group_member gm
            JOIN workspace_group g ON g.id = gm.group_id AND g.deleted_at IS NULL
            WHERE gm.member_id = :m AND gm.removed_at = :at
              AND NOT EXISTS (SELECT 1 FROM workspace_group_member l WHERE l.group_id = gm.group_id AND l.member_id = gm.member_id AND l.removed_at IS NULL)
            """
        ),
        {"m": target.id, "at": at},
    )
    grants = await session.execute(
        sa.text(
            """
            INSERT INTO document_grant (workspace_id, document_id, member_id, role)
            SELECT g.workspace_id, g.document_id, g.member_id, g.role FROM document_grant g
            JOIN document d ON d.id = g.document_id AND d.trashed_at IS NULL
            WHERE g.member_id = :m AND g.revoked_at = :at AND g.role <> 'OWNER'
              AND NOT EXISTS (SELECT 1 FROM document_grant l WHERE l.document_id = g.document_id AND l.member_id = g.member_id AND l.revoked_at IS NULL)
            """
        ),
        {"m": target.id, "at": at},
    )

    # return
    return Output(
        data={"groups": groups.rowcount, "grants": grants.rowcount},
        event=[],
    )
