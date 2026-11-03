from __future__ import annotations

import asyncio
import signal


class Lifecycle:
    def __init__(self):
        self._stop = asyncio.Event()

    async def wait(self):
        loop = asyncio.get_running_loop()

        for s in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(s, self._stop.set)
            
        await self._stop.wait()
