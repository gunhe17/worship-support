from __future__ import annotations

from typing import Protocol

from app.domains.project.domain import Project


class ProjectRepository(Protocol):
    def add(self, project: Project) -> None:
        ...

    def get(self, project_id: str) -> Project | None:
        ...

    def list_by_workspace(self, workspace_id: str) -> list[Project]:
        ...


class SqlAlchemyProjectRepository:
    def add(self, project: Project) -> None:
        raise NotImplementedError

    def get(self, project_id: str) -> Project | None:
        raise NotImplementedError

    def list_by_workspace(self, workspace_id: str) -> list[Project]:
        raise NotImplementedError
