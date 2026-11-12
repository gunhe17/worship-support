from __future__ import annotations

from worship_support.api.config import get_worker_config

from worship_support.api.infrastructure.database.postgresql.notification import notification_connection

from worship_support.api.worker.lifecycle import Lifecycle
from worship_support.api.worker.work import Work
from worship_support.api.worker.sweep import Sweep
from worship_support.api.worker.pool import Pool


class Worker:
    def __init__(self, name: str, concurrency: int = 16):
        self._name = name
        self._concurrency = concurrency

        self._works: list[Work] = []
        self._sweeps: list[Sweep] = []

    def work(self, work: Work):
        self._works.append(work)

    def sweep(self, sweep: Sweep):
        self._sweeps.append(sweep)

    async def run(self):
        pool = Pool(self._concurrency)
        lifecycle = Lifecycle()

        connection = await notification_connection()
        for work in self._works:
            await work.register(connection=connection, pool=pool)
        loops = [sweep.register(pool=pool) for sweep in self._sweeps]

        await lifecycle.wait()

        for loop in loops:
            loop.cancel()
        await connection.close()
        await pool.wait()


# #
# factory

def worship_support_worker():
    return Worker(
        name="worship-support-worker",
        concurrency=get_worker_config().CONCURRENCY,
    )
