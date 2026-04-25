from __future__ import annotations

from dataclasses import dataclass

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.core.roles import MembershipRole, MembershipStatus


@dataclass
class ChurchWorkspace:
    id: str
    name: str
    created_by: str


@dataclass
class Membership:
    id: str
    workspace_id: str
    user_id: str
    role: MembershipRole
    status: MembershipStatus

    def ensure_can_create_project(self) -> None:
        if self.role not in {
            MembershipRole.OWNER,
            MembershipRole.ADMIN,
            MembershipRole.EDITOR,
        }:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)

    def ensure_can_delete_project(self) -> None:
        if self.role not in {MembershipRole.OWNER, MembershipRole.ADMIN}:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)


@dataclass
class WorkspaceInvite:
    id: str
    workspace_id: str
    code: str
    expires_at: str
    created_by: str
    revoked_at: str | None = None
