from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from worship_support.api.config import get_database_config


config = get_database_config()
Base = declarative_base()


class _Database:
    _tables_created = False

    def __init__(self, url: str):
        self.database_url = url
        self.engine: AsyncEngine = create_async_engine(
            self.database_url,
            echo=False,
        )
        self.SessionLocal = async_sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )

    # helper

    async def create_tables_once_in_process(self):
        if not _Database._tables_created:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            _Database._tables_created = True

    async def delete_tables(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def close(self):
        await self.engine.dispose()


# #
# client

db_client = _Database(config.database_url())

@asynccontextmanager
async def transactional_session(session_factory):
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def transactional_session_helper():
    async with transactional_session(db_client.SessionLocal) as session:
        yield session


# #
# test

@asynccontextmanager
async def transactional_test_session_helper():
    from worship_support.api.config import TestDatabaseConfig
    
    config = TestDatabaseConfig()
    
    db_client = _Database(config.database_url())
    db_client._tables_created = False
    
    await db_client.create_tables_once_in_process()
    try:
        async with transactional_session(db_client.SessionLocal) as session:
            yield session
    finally:
        await db_client.delete_tables()
        await db_client.close()