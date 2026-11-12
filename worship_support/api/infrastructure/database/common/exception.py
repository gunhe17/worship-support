from __future__ import annotations

from worship_support.api.infrastructure.common.exception import InfrastructureClientError, InfrastructureDevelopError


# #
# develop

class ListenError(InfrastructureDevelopError):
    def __init__(self, operation: str, reason: str):
        super().__init__(key="listen_error", params={"operation": operation, "reason": reason}, code=500)


class DatabaseError(InfrastructureDevelopError):
    def __init__(self, operation: str, reason: str):
        super().__init__(key="database_error", params={"operation": operation, "reason": reason}, code=500)


# #
# client

class UniqueViolationError(InfrastructureClientError):
    def __init__(self, identifier: str):
        super().__init__(key="unique_violation", params={"identifier": identifier}, code=409)
