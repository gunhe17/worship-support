from __future__ import annotations

from dataclasses import dataclass

from app.core.roles import MembershipRole, MembershipStatus
from app.domains.workspace.domain import ChurchWorkspace, Membership
from app.domains.workspace.repository import (
    MembershipRepository,
    WorkspaceInviteRepository,
    WorkspaceRepository,
)
from app.domains.workspace.schema import (
    CreateWorkspaceRequest,
    JoinWorkspaceRequest,
    WorkspaceResponse,
)


@dataclass
class CreateWorkspaceUsecase:
    workspace_repository: WorkspaceRepository
    membership_repository: MembershipRepository

    def execute(self, request: CreateWorkspaceRequest, actor_id: str) -> WorkspaceResponse:
        workspace = ChurchWorkspace(
            id="generated-workspace-id",
            name=request.name,
            created_by=actor_id,
        )
        membership = Membership(
            id="generated-membership-id",
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
        if invite is None:
            raise NotImplementedError

        membership = self.membership_repository.get_active(invite.workspace_id, actor_id)
        if membership is None:
            membership = Membership(
                id="generated-membership-id",
                workspace_id=invite.workspace_id,
                user_id=actor_id,
                role=MembershipRole.VIEWER,
                status=MembershipStatus.ACTIVE,
            )
            self.membership_repository.add(membership)

        workspace = self.workspace_repository.get(invite.workspace_id)
        if workspace is None:
            raise NotImplementedError

        return WorkspaceResponse(id=workspace.id, name=workspace.name)
