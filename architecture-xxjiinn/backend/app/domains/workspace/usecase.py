from __future__ import annotations

from dataclasses import dataclass
import secrets

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.core.roles import MembershipRole, MembershipStatus
from app.core.security import days_from_now, now_utc
from app.domains.workspace.domain import ChurchWorkspace, Membership, WorkspaceInvite
from app.domains.workspace.repository import (
    MembershipRepository,
    WorkspaceInviteRepository,
    WorkspaceRepository,
)
from app.domains.workspace.schema import (
    CreateWorkspaceRequest,
    JoinWorkspaceRequest,
    UpdateMembershipRoleRequest,
    WorkspaceInviteResponse,
    WorkspaceResponse,
)


@dataclass
class CreateWorkspaceUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository

    def execute(self, request: CreateWorkspaceRequest, actor_id: str) -> WorkspaceResponse:
        workspace = ChurchWorkspace(
            id=self.workspace_repository.next_id(),
            name=request.name,
            created_by=actor_id,
        )
        membership = Membership(
            id=self.membership_repository.next_id(),
            workspace_id=workspace.id,
            user_id=actor_id,
            role=MembershipRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        self.workspace_repository.add(workspace)
        self.membership_repository.add(membership)
        return WorkspaceResponse(id=workspace.id, name=workspace.name)


@dataclass
class JoinWorkspaceUsecase:
    invite_repository: WorkspaceInviteRepository
    membership_repository: MembershipRepository
    workspace_repository: WorkspaceRepository

    def execute(self, request: JoinWorkspaceRequest, actor_id: str) -> WorkspaceResponse:
        invite = self.invite_repository.get_by_code(request.code)
        if invite is None or invite.is_revoked() or invite.is_expired(now_utc()):
            raise AppError(ErrorCode.WORKSPACE_INVITE_INVALID)

        workspace = self.workspace_repository.get(invite.workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_INVITE_INVALID)

        active_membership = self.membership_repository.get_active(invite.workspace_id, actor_id)
        if active_membership is None:
            latest_membership = self.membership_repository.get_latest(invite.workspace_id, actor_id)
            if latest_membership is not None and latest_membership.status == MembershipStatus.REMOVED:
                raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

            membership = Membership(
                id=self.membership_repository.next_id(),
                workspace_id=invite.workspace_id,
                user_id=actor_id,
                role=MembershipRole.VIEWER,
                status=MembershipStatus.ACTIVE,
            )
            self.membership_repository.add(membership)

        return WorkspaceResponse(id=workspace.id, name=workspace.name)


@dataclass
class CreateWorkspaceInviteUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository
    invite_repository: WorkspaceInviteRepository

    def execute(self, workspace_id: str, actor_id: str) -> WorkspaceInviteResponse:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_INVITE_INVALID)

        membership = self.membership_repository.get_active(workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)
        membership.ensure_can_manage_invites()

        invite = WorkspaceInvite(
            id=self.invite_repository.next_id(),
            workspace_id=workspace_id,
            code=secrets.token_urlsafe(16),
            expires_at=days_from_now(7),
            created_by=actor_id,
        )
        self.invite_repository.add(invite)
        return WorkspaceInviteResponse(code=invite.code, expires_at=invite.expires_at.isoformat())


@dataclass
class UpdateMembershipRoleUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository

    def execute(
        self,
        workspace_id: str,
        target_user_id: str,
        request: UpdateMembershipRoleRequest,
        actor_id: str,
    ) -> WorkspaceResponse:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        actor_membership = self.membership_repository.get_active(workspace_id, actor_id)
        if actor_membership is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        target_membership = self.membership_repository.get_active(workspace_id, target_user_id)
        if target_membership is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        if actor_membership.role == MembershipRole.ADMIN:
            if target_membership.role in {MembershipRole.OWNER, MembershipRole.ADMIN}:
                raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)
            if request.role not in {MembershipRole.EDITOR, MembershipRole.VIEWER}:
                raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)
        elif actor_membership.role != MembershipRole.OWNER:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        target_membership.role = request.role
        self.membership_repository.update(target_membership)
        return WorkspaceResponse(id=workspace.id, name=workspace.name)


@dataclass
class LeaveWorkspaceUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository

    def execute(self, workspace_id: str, actor_id: str) -> WorkspaceResponse:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND)

        membership = self.membership_repository.get_active(workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        if membership.role == MembershipRole.OWNER:
            active_memberships = self.membership_repository.list_active_by_workspace(workspace_id)
            active_owner_count = sum(1 for item in active_memberships if item.role == MembershipRole.OWNER)
            if active_owner_count == 1:
                raise AppError(ErrorCode.WORKSPACE_OWNER_TRANSFER_REQUIRED)

        membership.status = MembershipStatus.LEFT
        self.membership_repository.update(membership)
        return WorkspaceResponse(id=workspace.id, name=workspace.name)


@dataclass
class RemoveWorkspaceMemberUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository

    def execute(self, workspace_id: str, target_user_id: str, actor_id: str) -> WorkspaceResponse:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND)

        actor_membership = self.membership_repository.get_active(workspace_id, actor_id)
        target_membership = self.membership_repository.get_active(workspace_id, target_user_id)
        if actor_membership is None or target_membership is None:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        if actor_membership.user_id == target_membership.user_id:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        if actor_membership.role == MembershipRole.ADMIN:
            if target_membership.role in {MembershipRole.OWNER, MembershipRole.ADMIN}:
                raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)
        elif actor_membership.role != MembershipRole.OWNER:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        if target_membership.role == MembershipRole.OWNER:
            active_memberships = self.membership_repository.list_active_by_workspace(workspace_id)
            active_owner_count = sum(1 for item in active_memberships if item.role == MembershipRole.OWNER)
            if active_owner_count == 1:
                raise AppError(ErrorCode.WORKSPACE_OWNER_TRANSFER_REQUIRED)

        target_membership.status = MembershipStatus.REMOVED
        self.membership_repository.update(target_membership)
        return WorkspaceResponse(id=workspace.id, name=workspace.name)


@dataclass
class DeleteWorkspaceUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository
    project_repository: object

    def execute(self, workspace_id: str, actor_id: str) -> None:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND)

        membership = self.membership_repository.get_active(workspace_id, actor_id)
        if membership is None or membership.role != MembershipRole.OWNER:
            raise AppError(ErrorCode.WORKSPACE_FORBIDDEN)

        self.project_repository.soft_delete_by_workspace(workspace_id)
        self.workspace_repository.soft_delete(workspace_id)
