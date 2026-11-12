from __future__ import annotations

from typing import Any, Callable, ClassVar, Generic, TypeVar
from uuid import UUID

import sqlalchemy as sa

from worship_support.api.infrastructure.database.common.exception import UniqueViolationError
from worship_support.api.infrastructure.database.common.repository import Repository

E = TypeVar("E")
M = TypeVar("M")


# #
# repository

class PostgresRepository(Repository[E], Generic[E, M]):
    model: ClassVar[Any]
    mapper: ClassVar[Callable[[Any], Any]]
    tenant_column: ClassVar[str | None] = None

    # #
    # command

    @classmethod
    async def add(cls, *, session, entity: E) -> E:
        row = cls.model(**entity.to_model())
        session.add(row)
        await session.flush()
        await session.refresh(row)
        return cls.mapper(row)

    @classmethod
    async def update(cls, *, session, entity: E) -> E | None:
        return await cls._update(session=session, entity=entity, where=[])

    @classmethod
    async def _update(cls, *, session, entity: E, where: list) -> E | None:
        values = {
            key: value for key, value in entity.to_model().items() if key != "id"
        }
        if "updated_at" in cls.model.__table__.columns:
            values["updated_at"] = sa.func.now()
        statement = (
            sa.update(cls.model)
            .where(cls.model.id == entity.id, *where)
            .values(**values)
            .returning(cls.model)
        )
        row = (
            await session.execute(statement)
        ).scalar_one_or_none()
        return cls.mapper(row) if row is not None else None

    # #
    # query

    @classmethod
    async def find_by_id(cls, *, session, id: UUID) -> E | None:
        return await cls._find(session=session, where=[cls.model.id == id])

    @classmethod
    async def find_by_ids(cls, *, session, ids: list[UUID]) -> list[E]:
        if not ids:
            return []
        return await cls._filter(session=session, where=[cls.model.id.in_(ids)])

    @classmethod
    async def _find(cls, *, session, where: list, lock: bool = False) -> E | None:
        found = await cls._filter(session=session, where=where, limit=1, lock=lock)
        return found[0] if found else None

    @classmethod
    async def _filter(
        cls,
        *,
        session,
        where: list,
        order_by: Any = None,
        descending: bool = False,
        limit: int | None = None,
        lock: bool = False,
    ) -> list[E]:
        statement = sa.select(cls.model).where(*where)
        if order_by is not None:
            column = getattr(cls.model, order_by) if isinstance(order_by, str) else order_by
            statement = statement.order_by(column.desc() if descending else column.asc())
        if limit is not None:
            statement = statement.limit(limit)
        if lock:
            statement = statement.with_for_update()
        rows = (
            await session.execute(statement)
        ).scalars().all()
        return [
            cls.mapper(row) for row in rows
        ]

    @classmethod
    async def _count(cls, *, session, where: list) -> int:
        statement = sa.select(sa.func.count()).select_from(cls.model).where(*where)
        return (
            await session.execute(statement)
        ).scalar_one()

    @classmethod
    async def _exists(cls, *, session, where: list) -> bool:
        return await cls._count(session=session, where=where) > 0

    # #
    # tenanted

    @classmethod
    async def _tenanted_filter(cls, *, session, workspace_id: UUID, where: list, **options) -> list[E]:
        return await cls._filter(
            session=session,
            where=[getattr(cls.model, cls.tenant_column) == workspace_id, *where],
            **options,
        )

    @classmethod
    async def _tenanted_find(cls, *, session, workspace_id: UUID, where: list, lock: bool = False) -> E | None:
        found = await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=where,
            limit=1,
            lock=lock,
        )
        return found[0] if found else None

    @classmethod
    async def _tenanted_count(cls, *, session, workspace_id: UUID, where: list) -> int:
        return await cls._count(
            session=session,
            where=[getattr(cls.model, cls.tenant_column) == workspace_id, *where],
        )

    @classmethod
    async def _tenanted_update(cls, *, session, entity: E, workspace_id: UUID) -> E | None:
        return await cls._update(
            session=session,
            entity=entity,
            where=[getattr(cls.model, cls.tenant_column) == workspace_id],
        )

    # #
    # guard

    @classmethod
    async def _ensure_unique(cls, *, session, where: list, identifier: str) -> None:
        if await cls._exists(session=session, where=where):
            raise UniqueViolationError(identifier)

    # #
    # lock

    @classmethod
    async def _lock_rows(cls, *, session, model: Any, ids: list[UUID]) -> None:
        for id in sorted(ids, key=str):
            await session.execute(
                sa.select(model.id).where(model.id == id).with_for_update()
            )
