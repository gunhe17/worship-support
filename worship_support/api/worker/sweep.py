from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

from worship_support.api.worker.common.exception import WorkFailedError
from worship_support.api.worker.pool import Pool

Handler = Callable[[], Awaitable[None]]


class Sweep:
    def __init__(self, *, name: str, interval_sec: int, handler: Handler):
        self._name = name
        self._interval_sec = interval_sec
        self._handler = handler

    def register(self, *, pool: Pool) -> asyncio.Task:
        async def _run():
            try:
                await self._handler()
            except Exception as error:
                print(
                    WorkFailedError(channel=self._name, reason=str(error)).msg
                )

        async def _loop():
            while True:
                await asyncio.sleep(self._interval_sec)
                pool.submit(_run())

        return asyncio.create_task(_loop())
