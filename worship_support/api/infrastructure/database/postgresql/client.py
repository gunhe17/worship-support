from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from worship_support.api.config import get_postgres_config


# #
# database

class Postgres:
    def __init__(self, url: str):
        self.engine = create_async_engine(
            url.replace("postgresql://", "postgresql+asyncpg://", 1),
            pool_pre_ping=True,
        )
        self.SessionLocal = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
        )


# #
# client

db_client = Postgres(get_postgres_config().database_url())
