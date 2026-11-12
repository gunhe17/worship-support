from __future__ import annotations

from uuid import UUID

from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.infrastructure.hash.hmac.client import keyed_hash


# #
# derive

def link_token(*, kind: str, id: UUID) -> str:
    return keyed_hash.hash(f"{kind}:{id}")[:32]


def token_hash(*, value: str) -> TokenHash:
    return TokenHash.from_str(keyed_hash.hash(f"token:{value}"))


def code_hash(*, code: str) -> TokenHash:
    return TokenHash.from_str(keyed_hash.hash(f"invite_code:{code}"))
