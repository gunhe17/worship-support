from __future__ import annotations

import asyncio
from typing import Awaitable


class Pool:
    def __init__(self, size: int):
        self._semaphore = asyncio.Semaphore(size)
        self._in_progress: set[asyncio.Task] = set()

    # #
    # method

    def submit(self, coro: Awaitable[None]):
        task = asyncio.create_task(self._bounded(coro))
        
        # in progress
        self._in_progress.add(task)
        
        # done
        task.add_done_callback(
            self._in_progress.discard
        )

    async def wait(self):
        if self._in_progress:
            await asyncio.gather(*self._in_progress, return_exceptions=True)

    # #
    # helper
    
    async def _bounded(self, coro: Awaitable[None]):
        async with self._semaphore:
            await coro