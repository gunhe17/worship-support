from __future__ import annotations

from typing import Protocol
from uuid import uuid4

from app.core.database import Database
from app.core.roles import MembershipRole, MembershipStatus
from app.core.security import now_utc
from app.domains.workspace.domain import ChurchWorkspace, Membership, WorkspaceInvite


class WorkspaceRepository(Protocol):
    def next_id(self) -> str:
        ...

    def add(self, workspace: ChurchWorkspace) -> None:
        ...

    def get(self, workspace_id: str) -> ChurchWorkspace | None:
        ...

    def soft_delete(self, workspace_id: str) -> None:
        ...


class MembershipRepository(Protocol):
    def next_id(self) -> str:
        ...

    def get_active(self, workspace_id: str, user_id: str) -> Membership | None:
        ...

    def get_latest(self, workspace_id: str, user_id: str) -> Membership | None:
        ...

    def add(self, membership: Membership) -> None:
        ...

    def update(self, membership: Membership) -> None:
        ...

    def list_active_by_workspace(self, workspace_id: str) -> list[Membership]:
        ...


class WorkspaceInviteRepository(Protocol):
    def next_id(self) -> str:
        ...

    def add(self, invite: WorkspaceInvite) -> None:
        ...

    def get_by_code(self, code: str) -> WorkspaceInvite | None:
        ...


def _row_to_workspace(row) -> ChurchWorkspace:
    return ChurchWorkspace(id=row["id"], name=row["name"], created_by=row["created_by"])


def _row_to_membership(row) -> Membership:
    return Membership(
        id=row["id"],
        workspace_id=row["workspace_id"],
        user_id=row["user_id"],
        role=MembershipRole(row["role"]),
        status=MembershipStatus(row["status"]),
    )


def _row_to_invite(row) -> WorkspaceInvite:
    from datetime import datetime

    return WorkspaceInvite(
        id=row["id"],
        workspace_id=row["workspace_id"],
        code=row["code"],
        expires_at=datetime.fromisoformat(row["expires_at"]),
        created_by=row["created_by"],
        revoked_at=datetime.fromisoformat(row["revoked_at"]) if row["revoked_at"] else None,
    )


class SQLiteWorkspaceRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, workspace: ChurchWorkspace) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO workspaces (id, name, created_by, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, NULL)
                """,
                (workspace.id, workspace.name, workspace.created_by, timestamp, timestamp),
            )

    def get(self, workspace_id: str) -> ChurchWorkspace | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, created_by
                FROM workspaces
                WHERE id = ? AND deleted_at IS NULL
                """,
                (workspace_id,),
            ).fetchone()
        return _row_to_workspace(row) if row is not None else None

    def soft_delete(self, workspace_id: str) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE workspaces
                SET deleted_at = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (timestamp, timestamp, workspace_id),
            )


class SQLiteMembershipRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def get_active(self, workspace_id: str, user_id: str) -> Membership | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, workspace_id, user_id, role, status
                FROM memberships
                WHERE workspace_id = ? AND user_id = ? AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (workspace_id, user_id),
            ).fetchone()
        return _row_to_membership(row) if row is not None else None

    def get_latest(self, workspace_id: str, user_id: str) -> Membership | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, workspace_id, user_id, role, status
                FROM memberships
                WHERE workspace_id = ? AND user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (workspace_id, user_id),
            ).fetchone()
        return _row_to_membership(row) if row is not None else None

    def add(self, membership: Membership) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    membership.id,
                    membership.workspace_id,
                    membership.user_id,
                    membership.role.value,
                    membership.status.value,
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )

    def update(self, membership: Membership) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE memberships
                SET role = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (membership.role.value, membership.status.value, timestamp, membership.id),
            )

    def list_active_by_workspace(self, workspace_id: str) -> list[Membership]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, workspace_id, user_id, role, status
                FROM memberships
                WHERE workspace_id = ? AND status = 'active'
                ORDER BY created_at ASC
                """,
                (workspace_id,),
            ).fetchall()
        return [_row_to_membership(row) for row in rows]


class SQLiteWorkspaceInviteRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, invite: WorkspaceInvite) -> None:
        created_at = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO workspace_invites (id, workspace_id, code, expires_at, created_by, created_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    invite.id,
                    invite.workspace_id,
                    invite.code,
                    invite.expires_at.isoformat(),
                    invite.created_by,
                    created_at,
                    invite.revoked_at.isoformat() if invite.revoked_at else None,
                ),
            )

    def get_by_code(self, code: str) -> WorkspaceInvite | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, workspace_id, code, expires_at, created_by, revoked_at
                FROM workspace_invites
                WHERE code = ?
                """,
                (code,),
            ).fetchone()
        return _row_to_invite(row) if row is not None else None


class InMemoryWorkspaceRepository:
    def __init__(self) -> None:
        self._items: dict[str, ChurchWorkspace] = {}

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, workspace: ChurchWorkspace) -> None:
        self._items[workspace.id] = workspace

    def get(self, workspace_id: str) -> ChurchWorkspace | None:
        return self._items.get(workspace_id)

    def soft_delete(self, workspace_id: str) -> None:
        self._items.pop(workspace_id, None)


class InMemoryMembershipRepository:
    def __init__(self) -> None:
        self._items: list[Membership] = []

    def next_id(self) -> str:
        return str(uuid4())

    def get_active(self, workspace_id: str, user_id: str) -> Membership | None:
        membership = self.get_latest(workspace_id, user_id)
        if membership is None or membership.status.value != "active":
            return None
        return membership

    def get_latest(self, workspace_id: str, user_id: str) -> Membership | None:
        for membership in reversed(self._items):
            if membership.workspace_id == workspace_id and membership.user_id == user_id:
                return membership
        return None

    def add(self, membership: Membership) -> None:
        self._items.append(membership)

    def update(self, membership: Membership) -> None:
        _ = membership

    def list_active_by_workspace(self, workspace_id: str) -> list[Membership]:
        return [
            membership
            for membership in self._items
            if membership.workspace_id == workspace_id and membership.status.value == "active"
        ]


class InMemoryWorkspaceInviteRepository:
    def __init__(self) -> None:
        self._by_code: dict[str, WorkspaceInvite] = {}

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, invite: WorkspaceInvite) -> None:
        self._by_code[invite.code] = invite

    def get_by_code(self, code: str) -> WorkspaceInvite | None:
        return self._by_code.get(code)
