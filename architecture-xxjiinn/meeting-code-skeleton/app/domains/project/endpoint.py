from __future__ import annotations

from app.domains.project.schema import CreateProjectRequest
from app.domains.project.usecase import CreateProjectUsecase


class ProjectEndpoint:
    def __init__(self, create_project_usecase: CreateProjectUsecase) -> None:
        self.create_project_usecase = create_project_usecase

    def create(self, request: CreateProjectRequest, actor_id: str) -> dict[str, object]:
        project = self.create_project_usecase.execute(request, actor_id)
        return {"data": project.to_dict()}
