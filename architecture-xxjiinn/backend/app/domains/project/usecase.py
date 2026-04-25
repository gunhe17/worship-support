from __future__ import annotations

from dataclasses import dataclass

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.domains.project.domain import Project
from app.domains.project.repository import ProjectRepository
from app.domains.project.schema import (
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.domains.workspace.repository import MembershipRepository
from app.domains.workspace.repository import WorkspaceRepository


@dataclass
class CreateProjectUsecase:
    project_repository: ProjectRepository
    membership_repository: MembershipRepository
    workspace_repository: WorkspaceRepository

    def execute(self, request: CreateProjectRequest, actor_id: str) -> ProjectResponse:
        workspace = self.workspace_repository.get(request.workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND)

        membership = self.membership_repository.get_active(request.workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)

        membership.ensure_can_create_project()

        project = Project(
            id=self.project_repository.next_id(),
            workspace_id=request.workspace_id,
            name=request.name,
            description=request.description,
            created_by=actor_id,
        )
        self.project_repository.add(project)
        return ProjectResponse(
            id=project.id,
            workspace_id=project.workspace_id,
            name=project.name,
            description=project.description,
        )


@dataclass
class ListProjectsUsecase:
    project_repository: ProjectRepository
    membership_repository: MembershipRepository
    workspace_repository: WorkspaceRepository

    def execute(self, workspace_id: str, actor_id: str) -> ProjectListResponse:
        workspace = self.workspace_repository.get(workspace_id)
        if workspace is None:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND)

        membership = self.membership_repository.get_active(workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)

        items = [
            ProjectResponse(
                id=project.id,
                workspace_id=project.workspace_id,
                name=project.name,
                description=project.description,
            )
            for project in self.project_repository.list_by_workspace(workspace_id)
        ]
        return ProjectListResponse(items=items)


@dataclass
class UpdateProjectUsecase:
    project_repository: ProjectRepository
    membership_repository: MembershipRepository

    def execute(self, project_id: str, request: UpdateProjectRequest, actor_id: str) -> ProjectResponse:
        project = self.project_repository.get(project_id)
        if project is None:
            raise AppError(ErrorCode.PROJECT_NOT_FOUND)

        membership = self.membership_repository.get_active(project.workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)
        membership.ensure_can_create_project()

        project.update(name=request.name, description=request.description)
        self.project_repository.update(project)
        return ProjectResponse(
            id=project.id,
            workspace_id=project.workspace_id,
            name=project.name,
            description=project.description,
        )


@dataclass
class DeleteProjectUsecase:
    project_repository: ProjectRepository
    membership_repository: MembershipRepository

    def execute(self, project_id: str, actor_id: str) -> None:
        project = self.project_repository.get(project_id)
        if project is None:
            raise AppError(ErrorCode.PROJECT_NOT_FOUND)

        membership = self.membership_repository.get_active(project.workspace_id, actor_id)
        if membership is None:
            raise AppError(ErrorCode.PROJECT_FORBIDDEN)
        membership.ensure_can_delete_project()

        self.project_repository.soft_delete(project_id)
