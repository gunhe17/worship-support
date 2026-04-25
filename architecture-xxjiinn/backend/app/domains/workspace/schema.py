from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.roles import MembershipRole


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1)


class JoinWorkspaceRequest(BaseModel):
    code: str = Field(min_length=1)


class WorkspaceResponse(BaseModel):
    id: str
    name: str


class WorkspaceInviteResponse(BaseModel):
    code: str
    expires_at: str


class UpdateMembershipRoleRequest(BaseModel):
    role: MembershipRole
