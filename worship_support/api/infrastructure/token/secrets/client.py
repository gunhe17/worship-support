from __future__ import annotations

import secrets

from worship_support.api.infrastructure.token.common.client import Token


# #
# secrets

class Secrets(Token):
    def generate(self) -> str:
        return secrets.token_urlsafe(32)

    def generate_code(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"


# #
# client

token = Secrets()
