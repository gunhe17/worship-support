from __future__ import annotations

from typing import Any

from app.core.error_codes import ErrorCode


class AppError(Exception):
    def __init__(
        self,
        error_code: ErrorCode,
        context: dict[str, Any] | None = None,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(error_code.value)
        self.error_code = error_code
        self.context = context or {}
        self.cause = cause
