from __future__ import annotations

from worship_support.api.infrastructure.common.exception import InfrastructureDevelopError


# #
# develop

class ListenError(InfrastructureDevelopError):
    def __init__(self, operation: str, reason: str):
        super().__init__(key="listen_error", params={"operation": operation, "reason": reason}, code=500)
