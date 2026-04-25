from __future__ import annotations

from app.domains.workspace.schema import CreateWorkspaceRequest, JoinWorkspaceRequest
from app.domains.workspace.usecase import CreateWorkspaceUsecase, JoinWorkspaceUsecase


class WorkspaceEndpoint:
    def __init__(
        self,
        create_workspace_usecase: CreateWorkspaceUsecase,
        join_workspace_usecase: JoinWorkspaceUsecase,
    ) -> None:
        self.create_workspace_usecase = create_workspace_usecase
        self.join_workspace_usecase = join_workspace_usecase

    def create(self, request: CreateWorkspaceRequest, actor_id: str) -> dict[str, object]:
        workspace = self.create_workspace_usecase.execute(request, actor_id)
        return {"data": workspace.to_dict()}

    def join(self, request: JoinWorkspaceRequest, actor_id: str) -> dict[str, object]:
        workspace = self.join_workspace_usecase.execute(request, actor_id)
        return {"data": workspace.to_dict()}
