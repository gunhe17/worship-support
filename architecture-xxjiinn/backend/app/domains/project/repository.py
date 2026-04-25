from __future__ import annotations

from typing import Protocol
from uuid import uuid4

from app.core.database import Database
from app.core.security import now_utc
from app.domains.project.domain import Project


class ProjectRepository(Protocol):
    def next_id(self) -> str:
        ...

    def add(self, project: Project) -> None:
        ...

    def update(self, project: Project) -> None:
        ...

    def get(self, project_id: str) -> Project | None:
        ...

    def list_by_workspace(self, workspace_id: str) -> list[Project]:
        ...

    def soft_delete(self, project_id: str) -> None:
        ...

    def soft_delete_by_workspace(self, workspace_id: str) -> None:
        ...


def _row_to_project(row) -> Project:
    return Project(
        id=row["id"],
        workspace_id=row["workspace_id"],
        name=row["name"],
        description=row["description"],
        created_by=row["created_by"],
    )


class SQLiteProjectRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, project: Project) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (id, workspace_id, name, description, created_by, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    project.id,
                    project.workspace_id,
                    project.name,
                    project.description,
                    project.created_by,
                    timestamp,
                    timestamp,
                ),
            )

    def update(self, project: Project) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE projects
                SET name = ?, description = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (project.name, project.description, now_utc().isoformat(), project.id),
            )

    def get(self, project_id: str) -> Project | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, workspace_id, name, description, created_by
                FROM projects
                WHERE id = ? AND deleted_at IS NULL
                """,
                (project_id,),
            ).fetchone()
        return _row_to_project(row) if row is not None else None

    def list_by_workspace(self, workspace_id: str) -> list[Project]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, workspace_id, name, description, created_by
                FROM projects
                WHERE workspace_id = ? AND deleted_at IS NULL
                ORDER BY created_at ASC
                """,
                (workspace_id,),
            ).fetchall()
        return [_row_to_project(row) for row in rows]

    def soft_delete(self, project_id: str) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE projects
                SET deleted_at = ?, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (timestamp, timestamp, project_id),
            )

    def soft_delete_by_workspace(self, workspace_id: str) -> None:
        timestamp = now_utc().isoformat()
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE projects
                SET deleted_at = ?, updated_at = ?
                WHERE workspace_id = ? AND deleted_at IS NULL
                """,
                (timestamp, timestamp, workspace_id),
            )


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self._items: dict[str, Project] = {}

    def next_id(self) -> str:
        return str(uuid4())

    def add(self, project: Project) -> None:
        self._items[project.id] = project

    def update(self, project: Project) -> None:
        self._items[project.id] = project

    def get(self, project_id: str) -> Project | None:
        return self._items.get(project_id)

    def list_by_workspace(self, workspace_id: str) -> list[Project]:
        return [project for project in self._items.values() if project.workspace_id == workspace_id]

    def soft_delete(self, project_id: str) -> None:
        self._items.pop(project_id, None)

    def soft_delete_by_workspace(self, workspace_id: str) -> None:
        for project_id in [key for key, value in self._items.items() if value.workspace_id == workspace_id]:
            self._items.pop(project_id, None)
