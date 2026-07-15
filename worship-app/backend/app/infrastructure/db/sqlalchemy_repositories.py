"""
SQLAlchemy 기반 Repository 구현 (Supabase/PostgreSQL 연결용).
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entity.song import Song
from app.domain.entity.worship import Worship
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository
from app.infrastructure.orm.song_orm import SongORM
from app.infrastructure.orm.worship_orm import WorshipORM


def _orm_to_worship(row: WorshipORM) -> Worship:
    return Worship(
        id=row.id,
        title=row.title,
        scripture=row.scripture,
        sermon_direction=row.sermon_direction,
        duration_minutes=row.duration_minutes,
        created_at=row.created_at,
    )


def _orm_to_song(row: SongORM) -> Song:
    return Song(
        id=row.id,
        title=row.title,
        artist=row.artist,
        default_key=row.default_key,
        bpm=row.bpm,
        category=row.category,
        lyrics=row.lyrics,
        sheet=row.sheet,
    )


class SQLAlchemyWorshipRepository(WorshipRepository):
    def __init__(self, db: AsyncSession):
        self._db = db

    async def save(self, worship: Worship) -> Worship:
        row = WorshipORM(
            id=worship.id,
            title=worship.title,
            scripture=worship.scripture,
            sermon_direction=worship.sermon_direction,
            duration_minutes=worship.duration_minutes,
            created_at=worship.created_at,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_worship(row)

    async def find_by_id(self, worship_id: UUID) -> Worship | None:
        result = await self._db.execute(select(WorshipORM).where(WorshipORM.id == worship_id))
        row = result.scalar_one_or_none()
        return _orm_to_worship(row) if row else None

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Worship]:
        result = await self._db.execute(
            select(WorshipORM).order_by(WorshipORM.created_at.desc()).offset(skip).limit(limit)
        )
        return [_orm_to_worship(row) for row in result.scalars().all()]

    async def update(self, worship: Worship) -> Worship:
        result = await self._db.execute(select(WorshipORM).where(WorshipORM.id == worship.id))
        row = result.scalar_one_or_none()
        if row:
            row.title = worship.title
            row.scripture = worship.scripture
            row.sermon_direction = worship.sermon_direction
            row.duration_minutes = worship.duration_minutes
            await self._db.commit()
            await self._db.refresh(row)
        return _orm_to_worship(row)

    async def delete(self, worship_id: UUID) -> None:
        result = await self._db.execute(select(WorshipORM).where(WorshipORM.id == worship_id))
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()


class SQLAlchemySongRepository(SongRepository):
    def __init__(self, db: AsyncSession):
        self._db = db

    async def save(self, song: Song) -> Song:
        row = SongORM(
            id=song.id,
            title=song.title,
            artist=song.artist,
            default_key=song.default_key,
            bpm=song.bpm,
            category=song.category,
            lyrics=song.lyrics,
            sheet=song.sheet,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_song(row)

    async def find_by_id(self, song_id: UUID) -> Song | None:
        result = await self._db.execute(select(SongORM).where(SongORM.id == song_id))
        row = result.scalar_one_or_none()
        return _orm_to_song(row) if row else None

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Song]:
        result = await self._db.execute(select(SongORM).offset(skip).limit(limit))
        return [_orm_to_song(row) for row in result.scalars().all()]

    async def search(self, keyword: str) -> list[Song]:
        result = await self._db.execute(
            select(SongORM).where(
                SongORM.title.ilike(f"%{keyword}%") | SongORM.artist.ilike(f"%{keyword}%")
            )
        )
        return [_orm_to_song(row) for row in result.scalars().all()]

    async def update(self, song: Song) -> Song:
        result = await self._db.execute(select(SongORM).where(SongORM.id == song.id))
        row = result.scalar_one_or_none()
        if row:
            row.title = song.title
            row.artist = song.artist
            row.default_key = song.default_key
            row.bpm = song.bpm
            row.category = song.category
            row.lyrics = song.lyrics
            row.sheet = song.sheet
            await self._db.commit()
            await self._db.refresh(row)
        return _orm_to_song(row)

    async def delete(self, song_id: UUID) -> None:
        result = await self._db.execute(select(SongORM).where(SongORM.id == song_id))
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()
