from __future__ import annotations

import hashlib
from datetime import timedelta

from worship_support.api.config import get_policy_config
from worship_support.api.core.behavior import Action as CoreAction
from worship_support.api.domain.common.exception import ForbiddenError, UnauthorizedError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.login_session.login_session_repository import LoginSessionRepository
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.domain.workspace.workspace_repository import WorkspaceRepository
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberRepository
from worship_support.api.infrastructure.database.postgresql.clock import Clock

SESSION_COOKIE = "worship_session"


# #
# authenticate

class AuthenticateAccount(CoreAction):
    @classmethod
    async def act(cls, memory) -> None:
        raw = memory.request.cookies.get(SESSION_COOKIE)
        if not raw:
            raise UnauthorizedError()
        now = await Clock.now(session=memory.session)
        found = await LoginSessionRepository.find_valid_by_token_hash(
            session=memory.session,
            token_hash=TokenHash.from_str(hashlib.sha256(raw.encode()).hexdigest()),
            now=now,
            days=get_policy_config().SESSION_DAYS,
        )
        if found is None:
            raise UnauthorizedError()
        user = await UserRepository.find_by_id(
            session=memory.session,
            id=found.user_id,
        )
        if user is None or not user.is_active():
            raise UnauthorizedError()
        if found.last_used_at is None or now - found.last_used_at.to_datetime() > timedelta(hours=1):
            await LoginSessionRepository.update(
                session=memory.session,
                entity=found.touch(at=Moment.from_datetime(now)),
            )
        memory.user_id = user.id
        memory.login_session_id = found.id


# #
# authorize

class AuthorizeMember(CoreAction):
    @classmethod
    async def act(cls, memory) -> None:
        await WorkspaceRepository.get_open_by_id(
            session=memory.session,
            id=memory.workspace_id,
        )
        memory.member = await WorkspaceMemberRepository.tenanted_get_active_by_user(
            session=memory.session,
            workspace_id=memory.workspace_id,
            user_id=memory.user_id,
        )


class AuthorizeManager(CoreAction):
    @classmethod
    async def act(cls, memory) -> None:
        await AuthorizeMember.act(memory)
        if not memory.member.is_manager():
            raise ForbiddenError("공간 관리")
