from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import uuid4

from app.core.database import Database


@dataclass
class AuthAuditLogRecord:
    id: str
    event_type: str
    result: str
    user_id: str | None
    email_hash: str | None
    client_ip_hash: str | None
    user_agent_hash: str | None
    reason: str | None
    created_at: datetime


class AuthAuditLogRepository(Protocol):
    def next_id(self) -> str:
        ...

    def add(self, record: AuthAuditLogRecord) -> None:
        ...


class SQLiteAuthAuditLogRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, record: AuthAuditLogRecord) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO auth_audit_logs (
                    id, event_type, result, user_id, email_hash, client_ip_hash, user_agent_hash, reason, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.event_type,
                    record.result,
                    record.user_id,
                    record.email_hash,
                    record.client_ip_hash,
                    record.user_agent_hash,
                    record.reason,
                    record.created_at.isoformat(),
                ),
            )


class InMemoryAuthAuditLogRepository:
    def __init__(self) -> None:
        self.records: list[AuthAuditLogRecord] = []

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, record: AuthAuditLogRecord) -> None:
        self.records.append(record)
