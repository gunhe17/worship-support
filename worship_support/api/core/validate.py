from __future__ import annotations

import functools
import inspect
import types
import typing

from worship_support.api.core.exception import DevelopError as CoreDevelopError


# #
# typecheck

def typecheck(function):
    signature = inspect.signature(function)

    @functools.lru_cache(maxsize=1)
    def _hints():
        try:
            return typing.get_type_hints(function)
        except NameError:
            return {}

    def _check(arguments):
        hints = _hints()
        for name, value in arguments.items():
            expected = hints.get(name)
            if expected is None or name in ("cls", "self"):
                continue
            if not _matches(value=value, expected=expected):
                raise CoreDevelopError(
                    message=f"{name} {expected} 필요 (실제: {type(value).__name__})",
                    code=500,
                )

    if inspect.iscoroutinefunction(function):
        @functools.wraps(function)
        async def async_wrapper(*args, **kwargs):
            _check(signature.bind(*args, **kwargs).arguments)
            return await function(*args, **kwargs)

        return async_wrapper

    @functools.wraps(function)
    def wrapper(*args, **kwargs):
        _check(signature.bind(*args, **kwargs).arguments)
        return function(*args, **kwargs)

    return wrapper


def _matches(*, value, expected) -> bool:
    if expected is typing.Any:
        return True
    origin = typing.get_origin(expected)
    if origin in (typing.Union, types.UnionType):
        return any(
            _matches(value=value, expected=option) for option in typing.get_args(expected)
        )
    if expected is type(None):
        return value is None
    if origin is not None:
        return isinstance(value, origin)
    if isinstance(expected, type):
        return isinstance(value, expected)
    return True
