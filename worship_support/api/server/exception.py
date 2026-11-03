from __future__ import annotations

import sys
import traceback
from typing import Any, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from worship_support.api.config import is_develop
from worship_support.api.core.exception import ApplicationError as CoreApplicationError, ClientError as CoreClientError
from worship_support.api.core.i18n import DEFAULT as CoreDEFAULT, Locale as CoreLocale, render


class ExceptionHandler:
    def __init__(
        self,
        *,
        exception_class: type[Exception],
        handler: Callable[[Request, Exception], Any],
    ):
        self._exception_class = exception_class
        self._handler = handler

    def register(self, app: FastAPI):
        app.add_exception_handler(self._exception_class, self._handler)


# #
# locale

def _locale(request: Request) -> CoreLocale:
    header = request.headers.get("accept-language", "")
    for part in header.split(","):
        code = part.split(";")[0].strip().lower().split("-")[0]
        if code == CoreLocale.EN:
            return CoreLocale.EN
        if code == CoreLocale.KO:
            return CoreLocale.KO
    return CoreDEFAULT


# #
# factory

def client() -> ExceptionHandler:
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        # localize
        key = getattr(exc, "key", None)
        message = (
            render(key=key, params=getattr(exc, "params", {}), locale=_locale(request))
            if key
            else getattr(exc, "message", None) or str(exc)
        )

        # body
        body = {
            "error": type(exc).__name__,
            "message": message,
        }
        if is_develop() and isinstance(exc, CoreApplicationError):
            body["traceback"] = exc.__trace_back__()

        return JSONResponse(body, status_code=getattr(exc, "code", 400))

    return ExceptionHandler(
        exception_class=CoreClientError,
        handler=handler,
    )


def internal() -> ExceptionHandler:
    async def handler(_: Request, exc: Exception) -> JSONResponse:
        # trace
        error_id = str(uuid4())

        # log
        print(f"[error_id={error_id}] {type(exc).__name__}", file=sys.stderr)
        traceback.print_exception(type(exc), exc, exc.__traceback__)

        # body
        if is_develop():
            body = {
                "error": type(exc).__name__,
                "message": getattr(exc, "msg", None) or str(exc),
                "error_id": error_id,
                "traceback": "".join(
                    traceback.format_exception(type(exc), exc, exc.__traceback__)
                ),
            }
        else:
            body = {
                "error": "InternalServerError",
                "message": "internal server error",
                "error_id": error_id,
            }

        return JSONResponse(body, status_code=500)

    return ExceptionHandler(
        exception_class=Exception,
        handler=handler,
    )
