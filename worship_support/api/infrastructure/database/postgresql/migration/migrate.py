from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg

from worship_support.api.config import get_postgres_config, get_test_postgres_config


# #
# migrate

async def migrate(*, url: str) -> list[str]:
    connection = await asyncpg.connect(url)
    try:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_migration (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {
            row["version"] for row in await connection.fetch("SELECT version FROM schema_migration")
        }
        migrated = []
        for path in sorted(
            Path(
                __file__
            )
            .resolve()
            .parent.glob("sql/*.sql")
        ):
            if path.stem in applied:
                continue
            async with connection.transaction():
                await connection.execute(path.read_text())
                await connection.execute("INSERT INTO schema_migration (version) VALUES ($1)", path.stem)
            migrated.append(path.stem)
        return migrated
    finally:
        await connection.close()


# #
# cli

async def _main():
    config = get_test_postgres_config() if "--test" in sys.argv else get_postgres_config()
    print(
        await migrate(
            url=config.database_url(),
        )
    )

if __name__ == "__main__":
    asyncio.run(_main())
