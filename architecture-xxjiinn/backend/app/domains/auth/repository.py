from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import uuid4

from app.core.database import Database


@dataclass
class RefreshTokenRecord:
    id: str
    user_id: str
    token_hash: str
    expires_at: datetime
    created_at: datetime
    revoked_at: datetime | None = None

    def is_expired(self, now: datetime) -> bool:
        return self.expires_at <= now

    def is_revoked(self) -> bool:
        return self.revoked_at is not None


class RefreshTokenRepository(Protocol):
    def next_id(self) -> str:
        ...

    def add(self, record: RefreshTokenRecord) -> None:
        ...

    def get_by_token_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        ...

    def revoke(self, record: RefreshTokenRecord, revoked_at: datetime) -> None:
        ...

    def revoke_all_for_user(self, user_id: str, revoked_at: datetime) -> None:
        ...


def _row_to_refresh_token(row) -> RefreshTokenRecord:
    return RefreshTokenRecord(
        id=row["id"],
        user_id=row["user_id"],
        token_hash=row["token_hash"],
        expires_at=datetime.fromisoformat(row["expires_at"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        revoked_at=datetime.fromisoformat(row["revoked_at"]) if row["revoked_at"] else None,
    )


class SQLiteRefreshTokenRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, record: RefreshTokenRecord) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.user_id,
                    record.token_hash,
                    record.expires_at.isoformat(),
                    record.created_at.isoformat(),
                    record.revoked_at.isoformat() if record.revoked_at else None,
                ),
            )

    def get_by_token_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
                FROM refresh_tokens
                WHERE token_hash = ?
                """,
                (token_hash,),
            ).fetchone()
        return _row_to_refresh_token(row) if row is not None else None

    def revoke(self, record: RefreshTokenRecord, revoked_at: datetime) -> None:
        with self.database.connect() as connection:
            connection.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?",
                (revoked_at.isoformat(), record.id),
            )
        record.revoked_at = revoked_at

    def revoke_all_for_user(self, user_id: str, revoked_at: datetime) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE refresh_tokens
                SET revoked_at = ?
                WHERE user_id = ? AND revoked_at IS NULL
                """,
                (revoked_at.isoformat(), user_id),
            )


class InMemoryRefreshTokenRepository:
    def __init__(self) -> None:
        self._by_hash: dict[str, RefreshTokenRecord] = {}

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, record: RefreshTokenRecord) -> None:
        self._by_hash[record.token_hash] = record

    def get_by_token_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        return self._by_hash.get(token_hash)

    def revoke(self, record: RefreshTokenRecord, revoked_at: datetime) -> None:
        record.revoked_at = revoked_at

    def revoke_all_for_user(self, user_id: str, revoked_at: datetime) -> None:
        for record in self._by_hash.values():
            if record.user_id == user_id and record.revoked_at is None:
                record.revoked_at = revoked_at
