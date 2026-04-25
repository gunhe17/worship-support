from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import get_current_actor_id
from app.core.container import (
    membership_repository,
    project_repository,
    workspace_invite_repository,
    workspace_repository,
)
from app.domains.workspace.schema import (
    CreateWorkspaceRequest,
    JoinWorkspaceRequest,
    UpdateMembershipRoleRequest,
    WorkspaceInviteResponse,
    WorkspaceResponse,
)
from app.domains.workspace.usecase import (
    CreateWorkspaceInviteUsecase,
    CreateWorkspaceUsecase,
    DeleteWorkspaceUsecase,
    JoinWorkspaceUsecase,
    LeaveWorkspaceUsecase,
    RemoveWorkspaceMemberUsecase,
    UpdateMembershipRoleUsecase,
)

router = APIRouter(prefix="/workspaces", tags=["workspace"])


def _build_create_workspace_usecase() -> CreateWorkspaceUsecase:
    return CreateWorkspaceUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
    )


def _build_join_workspace_usecase() -> JoinWorkspaceUsecase:
    return JoinWorkspaceUsecase(
        invite_repository=workspace_invite_repository,
        membership_repository=membership_repository,
        workspace_repository=workspace_repository,
    )


def _build_create_workspace_invite_usecase() -> CreateWorkspaceInviteUsecase:
    return CreateWorkspaceInviteUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
        invite_repository=workspace_invite_repository,
    )


def _build_update_membership_role_usecase() -> UpdateMembershipRoleUsecase:
    return UpdateMembershipRoleUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
    )


def _build_leave_workspace_usecase() -> LeaveWorkspaceUsecase:
    return LeaveWorkspaceUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
    )


def _build_remove_workspace_member_usecase() -> RemoveWorkspaceMemberUsecase:
    return RemoveWorkspaceMemberUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
    )


def _build_delete_workspace_usecase() -> DeleteWorkspaceUsecase:
    return DeleteWorkspaceUsecase(
        workspace_repository=workspace_repository,
        membership_repository=membership_repository,
        project_repository=project_repository,
    )


@router.post("", status_code=201)
def create_workspace(
    request: CreateWorkspaceRequest,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceResponse]:
    workspace = _build_create_workspace_usecase().execute(request, actor_id=actor_id)
    return {"data": workspace}


@router.post("/join")
def join_workspace(
    request: JoinWorkspaceRequest,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceResponse]:
    workspace = _build_join_workspace_usecase().execute(request, actor_id=actor_id)
    return {"data": workspace}


@router.post("/{workspace_id}/invites", status_code=201)
def create_workspace_invite(
    workspace_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceInviteResponse]:
    invite = _build_create_workspace_invite_usecase().execute(workspace_id, actor_id=actor_id)
    return {"data": invite}


@router.patch("/{workspace_id}/members/{target_user_id}/role")
def update_membership_role(
    workspace_id: str,
    target_user_id: str,
    request: UpdateMembershipRoleRequest,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceResponse]:
    workspace = _build_update_membership_role_usecase().execute(
        workspace_id,
        target_user_id,
        request,
        actor_id=actor_id,
    )
    return {"data": workspace}


@router.post("/{workspace_id}/leave")
def leave_workspace(
    workspace_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceResponse]:
    workspace = _build_leave_workspace_usecase().execute(workspace_id, actor_id=actor_id)
    return {"data": workspace}


@router.delete("/{workspace_id}/members/{target_user_id}")
def remove_workspace_member(
    workspace_id: str,
    target_user_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, WorkspaceResponse]:
    workspace = _build_remove_workspace_member_usecase().execute(
        workspace_id,
        target_user_id,
        actor_id=actor_id,
    )
    return {"data": workspace}


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, object]:
    _build_delete_workspace_usecase().execute(workspace_id, actor_id=actor_id)
    return {"data": {"deleted": True}}
