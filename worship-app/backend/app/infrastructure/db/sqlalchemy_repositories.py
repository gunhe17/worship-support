"""
SQLAlchemy 기반 Repository 구현 (Supabase/PostgreSQL 연결용).
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entity.song import Song
from app.domain.entity.song_section import SongSection
from app.domain.entity.worship import Worship
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository
from app.infrastructure.orm.song_orm import SongORM
from app.infrastructure.orm.song_section_orm import SongSectionORM
from app.infrastructure.orm.worship_orm import WorshipORM


def _orm_to_worship(row: WorshipORM) -> Worship:
    return Worship(
        id=row.id,
        title=row.title,
        scripture=row.scripture,
        sermon_direction=row.sermon_direction,
        duration_minutes=row.duration_minutes,
        created_at=row.created_at,
        ai_result=row.ai_result,
    )


def _orm_to_section(row: SongSectionORM) -> SongSection:
    return SongSection(
        id=row.id,
        song_id=row.song_id,
        section_type=row.section_type,
        section_label=row.section_label,
        lyrics=row.lyrics,
        bars=row.bars,
        chord=row.chord,
        order=row.order,
    )


def _orm_to_song(row: SongORM, sections: list[SongSection] | None = None) -> Song:
    return Song(
        id=row.id,
        title=row.title,
        artist=row.artist,
        default_key=row.default_key,
        bpm=row.bpm,
        category=row.category,
        lyrics=row.lyrics,
        sheet=row.sheet,
        sections=sections or [],
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

    async def save_ai_result(self, worship_id: UUID, ai_result: dict) -> None:
        result = await self._db.execute(select(WorshipORM).where(WorshipORM.id == worship_id))
        row = result.scalar_one_or_none()
        if row:
            row.ai_result = ai_result
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

    async def find_sections(self, song_id: UUID) -> list[SongSection]:
        result = await self._db.execute(
            select(SongSectionORM)
            .where(SongSectionORM.song_id == song_id)
            .order_by(SongSectionORM.order)
        )
        return [_orm_to_section(r) for r in result.scalars().all()]

    async def save_section(self, section: SongSection) -> SongSection:
        row = SongSectionORM(
            id=section.id,
            song_id=section.song_id,
            section_type=section.section_type,
            section_label=section.section_label,
            lyrics=section.lyrics,
            bars=section.bars,
            chord=section.chord,
            order=section.order,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_section(row)

    async def update_section(self, section: SongSection) -> SongSection:
        result = await self._db.execute(
            select(SongSectionORM).where(SongSectionORM.id == section.id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.section_type = section.section_type
            row.section_label = section.section_label
            row.lyrics = section.lyrics
            row.bars = section.bars
            row.chord = section.chord
            row.order = section.order
            await self._db.commit()
            await self._db.refresh(row)
        return _orm_to_section(row)

    async def delete_section(self, section_id: UUID) -> None:
        result = await self._db.execute(
            select(SongSectionORM).where(SongSectionORM.id == section_id)
        )
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()

    async def find_section_by_id(self, section_id: UUID) -> SongSection | None:
        result = await self._db.execute(
            select(SongSectionORM).where(SongSectionORM.id == section_id)
        )
        row = result.scalar_one_or_none()
        return _orm_to_section(row) if row else None

    async def reorder_sections(self, song_id: UUID, section_ids: list[UUID]) -> list[SongSection]:
        for i, section_id in enumerate(section_ids):
            result = await self._db.execute(
                select(SongSectionORM).where(
                    SongSectionORM.id == section_id,
                    SongSectionORM.song_id == song_id,
                )
            )
            row = result.scalar_one_or_none()
            if row:
                row.order = i
        await self._db.commit()
        return await self.find_sections(song_id)
