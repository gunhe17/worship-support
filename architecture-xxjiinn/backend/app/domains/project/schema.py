from __future__ import annotations

from pydantic import BaseModel, Field


class CreateProjectRequest(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1)
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
