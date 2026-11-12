from __future__ import annotations

from uuid import UUID, uuid4

import sqlalchemy as sa

from worship_support.api.domain.common.exception import InvalidFormatError, StateError


# #
# repository

class DocumentRepository:
    @classmethod
    async def tenanted_create(cls, *, session, workspace_id: UUID, member_id: UUID, name: str) -> dict:
        normalized = name.strip()
        if not (1 <= len(normalized) <= 50):
            raise InvalidFormatError("문서 이름")
        taken = (
            await session.execute(
                sa.text("SELECT 1 FROM document WHERE workspace_id = :w AND trashed_at IS NULL AND normalize_name(name) = normalize_name(:n)"),
                {"w": workspace_id, "n": normalized},
            )
        ).first()
        if taken:
            raise StateError("document_name_taken")
        id = uuid4()
        await session.execute(
            sa.text("INSERT INTO document (id, workspace_id, name) VALUES (:id, :w, :n)"),
            {"id": id, "w": workspace_id, "n": normalized},
        )
        await session.execute(
            sa.text("INSERT INTO document_grant (workspace_id, document_id, member_id, role) VALUES (:w, :d, :m, 'OWNER')"),
            {"w": workspace_id, "d": id, "m": member_id},
        )
        return {"id": str(id), "name": normalized}

    @classmethod
    async def tenanted_search_visible(cls, *, session, workspace_id: UUID, member_id: UUID, manager: bool) -> list[dict]:
        rows = (
            await session.execute(
                sa.text(
                    """
                    SELECT d.id, d.name, d.visibility, d.updated_at,
                           mine.role AS my_role, u.name AS owner_name
                    FROM document d
                    LEFT JOIN document_grant mine ON mine.document_id = d.id AND mine.member_id = :m AND mine.revoked_at IS NULL
                    LEFT JOIN document_grant o ON o.document_id = d.id AND o.role = 'OWNER' AND o.revoked_at IS NULL
                    LEFT JOIN workspace_member om ON om.id = o.member_id
                    LEFT JOIN users u ON u.id = om.user_id
                    WHERE d.workspace_id = :w AND d.trashed_at IS NULL
                      AND (d.visibility = 'OPEN' OR mine.role IS NOT NULL OR :manager)
                    ORDER BY d.updated_at DESC
                    """
                ),
                {"w": workspace_id, "m": member_id, "manager": manager},
            )
        ).mappings().all()
        return [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "visibility": row["visibility"],
                "my_role": row["my_role"],
                "owner_name": row["owner_name"],
                "updated_at": row["updated_at"].isoformat(),
                "locked": row["visibility"] == "RESTRICTED" and row["my_role"] is None,
            }
            for row in rows
        ]
