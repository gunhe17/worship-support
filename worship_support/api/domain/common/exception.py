from __future__ import annotations

from worship_support.api.core.exception import ClientError as CoreClientError


# #
# base

class DomainClientError(CoreClientError):
    ...


# #
# input

class InvalidError(DomainClientError):
    def __init__(self, target: str):
        super().__init__(key="invalid", params={"target": target}, code=400)


class InvalidFormatError(DomainClientError):
    def __init__(self, target: str):
        super().__init__(key="invalid_format", params={"target": target}, code=400)


# #
# existence

class NotFoundError(DomainClientError):
    def __init__(self, target: str, identifier: str):
        super().__init__(key="not_found", params={"target": target, "identifier": identifier}, code=404)


class AlreadyExistsError(DomainClientError):
    def __init__(self, target: str, identifier: str):
        super().__init__(key="already_exists", params={"target": target, "identifier": identifier}, code=409)


# #
# access

class UnauthorizedError(DomainClientError):
    def __init__(self):
        super().__init__(key="unauthorized", params={}, code=401)


class ForbiddenError(DomainClientError):
    def __init__(self, action: str):
        super().__init__(key="forbidden", params={"action": action}, code=403)


# #
# state

class StateError(DomainClientError):
    def __init__(self, key: str, params: dict | None = None):
        super().__init__(key=key, params=params or {}, code=409)
