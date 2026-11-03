from __future__ import annotations

from worship_support.api.core.exception import ClientError as CoreClientError, DevelopError as CoreDevelopError


# #
# base

class InfrastructureDevelopError(CoreDevelopError):
    ...


class InfrastructureClientError(CoreClientError):
    ...
