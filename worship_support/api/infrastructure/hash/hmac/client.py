from __future__ import annotations

import hashlib
import hmac

from worship_support.api.config import get_secret_config
from worship_support.api.infrastructure.hash.common.client import Hash


# #
# hmac

class Hmac(Hash):
    def __init__(self, key: str):
        self._key = key.encode()

    def hash(self, value: str) -> str:
        return hmac.new(self._key, value.encode(), hashlib.sha256).hexdigest()


# #
# client

keyed_hash = Hmac(get_secret_config().SECRET_KEY)
