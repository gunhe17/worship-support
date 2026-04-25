from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CreateProjectRequest:
    workspace_id: str
    name: str
    description: str | None = None


@dataclass(frozen=True)
class ProjectResponse:
    id: str
    workspace_id: str
    name: str
    description: str | None

    def to_dict(self) -> dict[str, str | None]:
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "description": self.description,
        }
