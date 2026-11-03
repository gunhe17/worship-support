from __future__ import annotations

import asyncpg

from worship_support.api.config import get_postgres_config
from worship_support.api.infrastructure.database.common.exception import ListenError


# #
# listen

class Connection:
    def __init__(self, connection: asyncpg.Connection):
        self._connection = connection

    async def listen(self, *, channel: str, callback):
        try:
            await self._connection.add_listener(channel, callback)

        except (asyncpg.PostgresError, OSError) as exc:
            raise ListenError(operation=f"listen:{channel}", reason=str(exc))

    async def close(self):
        await self._connection.close()


# #
# factory

async def notification_connection() -> Connection:
    try:
        connection = await asyncpg.connect(get_postgres_config().database_url())

    except (asyncpg.PostgresError, OSError) as exc:
        raise ListenError(operation="connect", reason=str(exc))

    return Connection(connection=connection)
