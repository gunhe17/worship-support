from __future__ import annotations

from typing import Protocol

from app.domains.workspace.domain import ChurchWorkspace, Membership, WorkspaceInvite


class WorkspaceRepository(Protocol):
    def add(self, workspace: ChurchWorkspace) -> None:
        ...

    def get(self, workspace_id: str) -> ChurchWorkspace | None:
        ...


class MembershipRepository(Protocol):
    def get_active(self, workspace_id: str, user_id: str) -> Membership | None:
        ...

    def add(self, membership: Membership) -> None:
        ...


class WorkspaceInviteRepository(Protocol):
    def get_by_code(self, code: str) -> WorkspaceInvite | None:
        ...


class SqlAlchemyWorkspaceRepository:
    def add(self, workspace: ChurchWorkspace) -> None:
        raise NotImplementedError

    def get(self, workspace_id: str) -> ChurchWorkspace | None:
        raise NotImplementedError


class SqlAlchemyMembershipRepository:
    def get_active(self, workspace_id: str, user_id: str) -> Membership | None:
        raise NotImplementedError

    def add(self, membership: Membership) -> None:
        raise NotImplementedError


class SqlAlchemyWorkspaceInviteRepository:
    def get_by_code(self, code: str) -> WorkspaceInvite | None:
        raise NotImplementedError
