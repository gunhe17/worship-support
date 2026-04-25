from __future__ import annotations

import json
from typing import Protocol
from uuid import uuid4

from app.core.database import Database
from app.core.security import now_utc
from app.domains.user.domain import Email, PasswordHash, User, UserStatus


class UserRepository(Protocol):
    def get(self, user_id: str) -> User | None:
        ...

    def get_by_email(self, email: Email) -> User | None:
        ...

    def exists_by_email(self, email: Email) -> bool:
        ...

    def add(self, user: User) -> None:
        ...

    def archive_and_deactivate(self, user: User) -> None:
        ...


def _row_to_user(row) -> User:
    return User(
        id=row["id"],
        email=Email(row["email"]),
        password_hash=PasswordHash(row["password_hash"]),
        name=row["name"],
        status=UserStatus(row["status"]),
    )


class SQLiteUserRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def get(self, user_id: str) -> User | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, email, password_hash, name, status
                FROM users
                WHERE id = ? AND deleted_at IS NULL
                """,
                (user_id,),
            ).fetchone()
        return _row_to_user(row) if row is not None else None

    def get_by_email(self, email: Email) -> User | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, email, password_hash, name, status
                FROM users
                WHERE email = ? AND deleted_at IS NULL
                """,
                (email.value,),
            ).fetchone()
        return _row_to_user(row) if row is not None else None

    def exists_by_email(self, email: Email) -> bool:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT 1 FROM users WHERE email = ? AND deleted_at IS NULL",
                (email.value,),
            ).fetchone()
        return row is not None

    def add(self, user: User) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO users (id, email, password_hash, name, status, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    user.id,
                    user.email.value,
                    user.password_hash.value,
                    user.name,
                    user.status.value,
                    timestamp,
                    timestamp,
                ),
            )

    def archive_and_deactivate(self, user: User) -> None:
        archived_at = now_utc().isoformat()
        snapshot = json.dumps(
            {
                "id": user.id,
                "email": user.email.value,
                "name": user.name,
                "status": user.status.value,
            },
            separators=(",", ":"),
        )
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO user_archives (id, user_id, email, name, status, archived_snapshot, archived_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    user.id,
                    user.email.value,
                    user.name,
                    user.status.value,
                    snapshot,
                    archived_at,
                ),
            )
            connection.execute(
                """
                UPDATE users
                SET status = ?, deleted_at = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (user.status.value, archived_at, archived_at, user.id),
            )


class InMemoryUserRepository:
    def __init__(self) -> None:
        self._by_id: dict[str, User] = {}
        self._by_email: dict[str, str] = {}

    def next_id(self) -> str:
        return str(uuid4())

    def get(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)

    def get_by_email(self, email: Email) -> User | None:
        user_id = self._by_email.get(email.value)
        if user_id is None:
            return None
        return self._by_id.get(user_id)

    def exists_by_email(self, email: Email) -> bool:
        return email.value in self._by_email

    def add(self, user: User) -> None:
        self._by_id[user.id] = user
        self._by_email[user.email.value] = user.id

    def archive_and_deactivate(self, user: User) -> None:
        self._by_id.pop(user.id, None)
        self._by_email.pop(user.email.value, None)
