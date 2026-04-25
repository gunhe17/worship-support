from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import get_current_actor_id
from app.core.container import membership_repository, project_repository, workspace_repository
from app.domains.project.schema import (
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.domains.project.usecase import CreateProjectUsecase, ListProjectsUsecase, UpdateProjectUsecase
from app.domains.project.usecase import DeleteProjectUsecase

router = APIRouter(prefix="/projects", tags=["project"])


def _build_create_project_usecase() -> CreateProjectUsecase:
    return CreateProjectUsecase(
        project_repository=project_repository,
        membership_repository=membership_repository,
        workspace_repository=workspace_repository,
    )


def _build_list_projects_usecase() -> ListProjectsUsecase:
    return ListProjectsUsecase(
        project_repository=project_repository,
        membership_repository=membership_repository,
        workspace_repository=workspace_repository,
    )


def _build_update_project_usecase() -> UpdateProjectUsecase:
    return UpdateProjectUsecase(
        project_repository=project_repository,
        membership_repository=membership_repository,
    )


def _build_delete_project_usecase() -> DeleteProjectUsecase:
    return DeleteProjectUsecase(
        project_repository=project_repository,
        membership_repository=membership_repository,
    )


@router.post("", status_code=201)
def create_project(
    request: CreateProjectRequest,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, ProjectResponse]:
    project = _build_create_project_usecase().execute(request, actor_id=actor_id)
    return {"data": project}


@router.get("")
def list_projects(
    workspace_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, ProjectListResponse]:
    projects = _build_list_projects_usecase().execute(workspace_id, actor_id=actor_id)
    return {"data": projects}


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, ProjectResponse]:
    project = _build_update_project_usecase().execute(project_id, request, actor_id=actor_id)
    return {"data": project}


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    actor_id: str = Depends(get_current_actor_id),
) -> dict[str, object]:
    _build_delete_project_usecase().execute(project_id, actor_id=actor_id)
    return {"data": {"deleted": True}}
