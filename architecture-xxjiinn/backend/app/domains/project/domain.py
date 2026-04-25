from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Project:
    id: str
    workspace_id: str
    name: str
    description: str | None
    created_by: str

    def update(self, name: str, description: str | None) -> None:
        self.name = name
        self.description = description
