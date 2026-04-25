from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CreateWorkspaceRequest:
    name: str


@dataclass(frozen=True)
class JoinWorkspaceRequest:
    code: str


@dataclass(frozen=True)
class WorkspaceResponse:
    id: str
    name: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name}
