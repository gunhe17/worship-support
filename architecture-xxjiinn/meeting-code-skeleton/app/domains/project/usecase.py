from __future__ import annotations

from dataclasses import dataclass

from app.domains.project.domain import Project
from app.domains.project.repository import ProjectRepository
from app.domains.project.schema import CreateProjectRequest, ProjectResponse
from app.domains.workspace.repository import MembershipRepository


@dataclass
class CreateProjectUsecase:
    project_repository: ProjectRepository
    membership_repository: MembershipRepository

    def execute(self, request: CreateProjectRequest, actor_id: str) -> ProjectResponse:
        membership = self.membership_repository.get_active(request.workspace_id, actor_id)
        if membership is None:
            raise NotImplementedError

        membership.ensure_can_create_project()

        project = Project(
            id="generated-project-id",
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
