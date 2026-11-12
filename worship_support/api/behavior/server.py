from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Request

from worship_support.api.behavior.action.access import AuthenticateAccount, AuthorizeManager, AuthorizeMember
from worship_support.api.core.behavior import Behavior as CoreBehavior
from worship_support.api.core.behavior import Memory as CoreMemory
from worship_support.api.core.behavior import Scope as CoreScope
from worship_support.api.infrastructure.database.common.session import transactional_session
from worship_support.api.infrastructure.database.postgresql.client import db_client


# #
# scope

@dataclass(frozen=True, kw_only=True)
class RequestScope(CoreScope):
    session: object
    user_id: UUID | None
    login_session_id: UUID | None


@dataclass(frozen=True, kw_only=True)
class RequestWorkspaceScope(CoreScope):
    session: object
    user_id: UUID
    workspace_id: UUID
    member_id: UUID


# #
# server

class Server(CoreBehavior):
    def request(self, *requires):
        behavior = self

        class RequestMemory(CoreMemory):
            request: Request
            session: object = None
            user_id: UUID | None = None
            login_session_id: UUID | None = None

        async def request_flow(request: Request):
            memory = RequestMemory()
            memory.request = request
            behavior.set_action(memory, *requires)
            async with transactional_session(db_client.SessionLocal) as session:
                memory.session = session
                await behavior.run_action(memory, action=AuthenticateAccount)
                yield RequestScope(
                    session=session,
                    user_id=memory.user_id,
                    login_session_id=memory.login_session_id,
                )

        return request_flow

    def request_workspace(self, *requires):
        behavior = self

        class RequestMemory(CoreMemory):
            request: Request
            session: object = None
            user_id: UUID | None = None
            login_session_id: UUID | None = None
            workspace_id: UUID | None = None
            member: object = None

        async def request_flow(request: Request, workspace_id: UUID):
            memory = RequestMemory()
            memory.request = request
            memory.workspace_id = workspace_id
            behavior.set_action(memory, AuthenticateAccount(), *requires)
            async with transactional_session(db_client.SessionLocal) as session:
                memory.session = session
                await behavior.run_action(memory, action=AuthenticateAccount)
                await behavior.run_action(memory, action=AuthorizeMember)
                await behavior.run_action(memory, action=AuthorizeManager)
                yield RequestWorkspaceScope(
                    session=session,
                    user_id=memory.user_id,
                    workspace_id=workspace_id,
                    member_id=memory.member.id,
                )

        return request_flow


# #
# behavior

behavior = Server()
