from __future__ import annotations

from typing import Awaitable, Callable

from worship_support.api.worker.common.exception import WorkFailedError
from worship_support.api.worker.pool import Pool

Handler = Callable[[str], Awaitable[None]]


class Work:
    def __init__(self, *, channel: str, handler: Handler):
        self._channel = channel
        self._handler = handler

    async def register(self, *, connection, pool: Pool):
        async def _run(payload: str):
            try:
                await self._handler(payload)
            except Exception as error:
                print(
                    WorkFailedError(channel=self._channel, reason=str(error)).msg
                )

        def _on_notify(conn, pid, channel, payload):
            pool.submit(_run(payload))

        await connection.listen(channel=self._channel, callback=_on_notify)