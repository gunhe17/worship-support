from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.error_codes import ErrorCode
from app.core.error_mapping import ERROR_HTTP_STATUS, ERROR_MESSAGE
from app.core.exceptions import AppError


def build_error_response(
    error_code: ErrorCode,
    request_id: str,
    *,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    payload: dict[str, object] = {
        "error": {
            "code": error_code.value,
            "message": ERROR_MESSAGE[error_code],
            "request_id": request_id,
        }
    }
    if errors:
        payload["error"]["errors"] = errors
    return JSONResponse(status_code=ERROR_HTTP_STATUS[error_code], content=payload)


def register_exception_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-Id", "generated-request-id")
        return await call_next(request)

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        return build_error_response(exc.error_code, request.state.request_id)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        errors = []
        for item in exc.errors():
            location = item.get("loc", [])
            field = str(location[-1]) if location else "unknown"
            errors.append(
                {
                    "code": ErrorCode.COMMON_VALIDATION_ERROR.value,
                    "field": field,
                }
            )
        return build_error_response(
            ErrorCode.COMMON_VALIDATION_ERROR,
            request.state.request_id,
            errors=errors,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        _ = exc
        return build_error_response(
            ErrorCode.COMMON_INTERNAL_SERVER_ERROR,
            request.state.request_id,
        )
