from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProjectModel:
    id: str
    workspace_id: str
    name: str
    description: str | None
    created_by: str
    created_at: str
    updated_at: str
    deleted_at: str | None = None
