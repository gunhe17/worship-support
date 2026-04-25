from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import settings


class Database:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT NULL
                );

                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    revoked_at TEXT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS auth_audit_logs (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    result TEXT NOT NULL,
                    user_id TEXT NULL,
                    email_hash TEXT NULL,
                    client_ip_hash TEXT NULL,
                    user_agent_hash TEXT NULL,
                    reason TEXT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS user_archives (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    email TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    archived_snapshot TEXT NOT NULL,
                    archived_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT NULL,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS memberships (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    status TEXT NOT NULL,
                    joined_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_active
                ON memberships(workspace_id, user_id)
                WHERE status = 'active';

                CREATE TABLE IF NOT EXISTS workspace_invites (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    revoked_at TEXT NULL,
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
                    FOREIGN KEY (created_by) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT NULL,
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
                    FOREIGN KEY (created_by) REFERENCES users(id)
                );
                """
            )


database = Database(settings.database_path)
