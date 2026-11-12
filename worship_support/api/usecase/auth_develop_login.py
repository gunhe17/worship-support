from __future__ import annotations

import hashlib

from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.login_session.device_label import DeviceLabel
from worship_support.api.domain.login_session.login_session import LoginSession
from worship_support.api.domain.login_session.login_session_repository import LoginSessionRepository
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.user.name import Name
from worship_support.api.domain.user.social_account.provider import Provider
from worship_support.api.domain.user.social_account.social_account import SocialAccount
from worship_support.api.domain.user.social_account.subject import Subject
from worship_support.api.domain.user.user import User
from worship_support.api.domain.user.user_repository import UserRepository
from worship_support.api.infrastructure.token.secrets.client import token


# #
# input

class Input(CoreIn):
    email: str
    name: str | None = None
    device_label: str | None = None


# #
# output

class Output(CoreOut):
    pass


# #
# usecase

@typecheck
async def login(*, session, input: Input) -> Output:
    # find
    email = Email.from_str(input.email)
    subject = Subject.from_str(f"develop:{email.to_str()}")
    user = await UserRepository.find_by_social(
        session=session,
        provider=Provider.from_str("GOOGLE"),
        subject=subject,
    )

    # login
    if user is None:
        user = await UserRepository.add(
            session=session,
            entity=User.new(name=Name.from_str(input.name or email.to_str().split("@")[0])),
        )
        await UserRepository.add_social_account(
            session=session,
            entity=SocialAccount.new(
                user_id=user.id,
                provider=Provider.from_str("GOOGLE"),
                subject=subject,
                provider_email=email,
            ),
        )
    raw = token.generate()
    await LoginSessionRepository.add(
        session=session,
        entity=LoginSession.new(
            user_id=user.id,
            token_hash=TokenHash.from_str(hashlib.sha256(raw.encode()).hexdigest()),
            device_label=(
                DeviceLabel.from_str(input.device_label[:200]) if input.device_label else None
            ),
        ),
    )

    # return
    return Output(
        data={"user": user.to_dict(), "token": raw},
        event=[],
    )
