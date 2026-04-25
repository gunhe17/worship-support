import asyncio

from sqlalchemy import Column, Integer, String, text

from worship_support.api.config import TestDatabaseConfig
from worship_support.api.infrastructure.postgresql import Base, _Database


class _Probe(Base):
    __tablename__ = "_probe"

    id = Column(Integer, primary_key=True)
    name = Column(String(32), nullable=False)


async def test_database_create_insert_query_delete():
    _Database._tables_created = False
    db = _Database(TestDatabaseConfig().database_url())

    try:
        # 1. create
        await db.create_tables_once_in_process()

        async with db.engine.connect() as conn:
            created = await conn.execute(text("SELECT to_regclass('_probe')"))
            assert created.scalar() is not None

        # 2. insert + query
        async with db.SessionLocal() as write:
            write.add(_Probe(id=1, name="hello"))
            await write.commit()

        async with db.SessionLocal() as read:
            row = await read.execute(
                text("SELECT name FROM _probe WHERE id = :id"),
                {"id": 1},
            )
            assert row.scalar() == "hello"

        # 3. delete
        await db.delete_tables()

        async with db.engine.connect() as conn:
            dropped = await conn.execute(text("SELECT to_regclass('_probe')"))
            assert dropped.scalar() is None

    finally:
        await db.close()
        _Database._tables_created = False


async def main():
    tests = [test_database_create_insert_query_delete]

    failed = 0
    for t in tests:
        name = t.__name__
        try:
            await t()
        except Exception as e:
            failed += 1
            print(f"FAIL {name}: {type(e).__name__}: {e}")
        else:
            print(f"PASS {name}")

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
