from __future__ import annotations

from worship_support.api.core.exception import DevelopError as CoreDevelopError


# #
# base

class WorkerDevelopError(CoreDevelopError):
    ...


# #
# execution

class WorkFailedError(WorkerDevelopError):
    def __init__(self, channel: str, reason: str):
        super().__init__(key="work_failed", params={"channel": channel, "reason": reason}, code=500)
