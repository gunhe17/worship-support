from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChurchWorkspaceModel:
    id: str
    name: str
    created_by: str
    created_at: str
    updated_at: str
    deleted_at: str | None = None


@dataclass
class MembershipModel:
    id: str
    workspace_id: str
    user_id: str
    role: str
    status: str
    joined_at: str
    created_at: str
    updated_at: str


@dataclass
class WorkspaceInviteModel:
    id: str
    workspace_id: str
    code: str
    expires_at: str
    created_by: str
    created_at: str
    revoked_at: str | None = None
