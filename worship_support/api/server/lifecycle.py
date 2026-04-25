from contextlib import asynccontextmanager
from typing import Awaitable, Callable

from fastapi import FastAPI

from worship_support.api.infrastructure.postgresql import db_client

Hook = Callable[[], Awaitable[None]]


class Lifecycle:
    def __init__(
        self,
        on_startup: list[Hook] | None = None,
        on_shutdown: list[Hook] | None = None,
    ):
        self._on_startup: list[Hook] = on_startup or []
        self._on_shutdown: list[Hook] = on_shutdown or []

    def on_startup(self, hook: Hook):
        self._on_startup.append(hook)

    def on_shutdown(self, hook: Hook):
        self._on_shutdown.append(hook)

    def lifespan(self):
        @asynccontextmanager
        async def _lifespan(app: FastAPI):
            for hook in self._on_startup:
                await hook()
            yield
            for hook in self._on_shutdown:
                await hook()

        return _lifespan


# #
# Lifecycle

def database():
    return Lifecycle(
        on_startup=[db_client.create_tables_once_in_process],
        on_shutdown=[db_client.close],
    )
