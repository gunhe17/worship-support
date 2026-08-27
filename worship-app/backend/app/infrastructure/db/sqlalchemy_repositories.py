"""
SQLAlchemy 기반 Repository 구현 (Supabase/PostgreSQL 연결용).
"""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entity.post import Comment, Post, PostSong
from app.domain.entity.song import Song
from app.domain.entity.song_section import SongSection
from app.domain.entity.song_sheet import SongSheet
from app.domain.entity.worship import Worship
from app.domain.repository.post_repository import PostRepository
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository
from app.domain.entity.song_arrangement import SongArrangement
from app.infrastructure.orm.post_orm import CommentORM, PostORM, PostSongORM
from app.infrastructure.orm.song_arrangement_orm import SongArrangementORM
from app.infrastructure.orm.song_orm import SongORM
from app.infrastructure.orm.song_section_orm import SongSectionORM
from app.infrastructure.orm.song_sheet_orm import SongSheetORM
from app.infrastructure.orm.worship_orm import WorshipORM


def _orm_to_worship(row: WorshipORM) -> Worship:
    return Worship(
        id=row.id,
        title=row.title,
        scripture=row.scripture,
        sermon_direction=row.sermon_direction,
        duration_minutes=row.duration_minutes,
        leader_meditation=getattr(row, "leader_meditation", ""),
        created_at=row.created_at,
        ai_result=row.ai_result,
    )


def _orm_to_arrangement(row: SongArrangementORM) -> SongArrangement:
    return SongArrangement(
        id=row.id,
        worship_id=row.worship_id,
        song_id=row.song_id,
        order=row.order,
        song_form=list(row.song_form or []),
        ment=row.ment,
        memo=row.memo,
        key=row.key,
        tempo=row.tempo,
        sheet_url=row.sheet_url,
    )


def _orm_to_sheet(row: SongSheetORM) -> SongSheet:
    return SongSheet(
        id=row.id,
        song_id=row.song_id,
        key=row.key,
        sheet_url=row.sheet_url,
        page_order=row.page_order,
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
            row.leader_meditation = worship.leader_meditation
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

    async def save_arrangement(self, arr: SongArrangement) -> SongArrangement:
        row = SongArrangementORM(
            id=arr.id,
            worship_id=arr.worship_id,
            song_id=arr.song_id,
            order=arr.order,
            song_form=arr.song_form,
            ment=arr.ment,
            memo=arr.memo,
            key=arr.key,
            tempo=arr.tempo,
            sheet_url=arr.sheet_url,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_arrangement(row)

    async def find_arrangements(self, worship_id: UUID) -> list[SongArrangement]:
        result = await self._db.execute(
            select(SongArrangementORM)
            .where(SongArrangementORM.worship_id == worship_id)
            .order_by(SongArrangementORM.order)
        )
        return [_orm_to_arrangement(r) for r in result.scalars().all()]

    async def find_arrangement_by_id(self, arr_id: UUID) -> SongArrangement | None:
        result = await self._db.execute(
            select(SongArrangementORM).where(SongArrangementORM.id == arr_id)
        )
        row = result.scalar_one_or_none()
        return _orm_to_arrangement(row) if row else None

    async def update_arrangement(self, arr: SongArrangement) -> SongArrangement:
        result = await self._db.execute(
            select(SongArrangementORM).where(SongArrangementORM.id == arr.id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.order = arr.order
            row.song_form = arr.song_form
            row.ment = arr.ment
            row.sheet_url = arr.sheet_url
            await self._db.commit()
            await self._db.refresh(row)
        return _orm_to_arrangement(row)

    async def delete_arrangement(self, arr_id: UUID) -> None:
        result = await self._db.execute(
            select(SongArrangementORM).where(SongArrangementORM.id == arr_id)
        )
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
        kw = f"%{keyword}%"
        kw_no_space = f"%{keyword.replace(' ', '')}%"
        result = await self._db.execute(
            select(SongORM).where(
                SongORM.title.ilike(kw)
                | SongORM.artist.ilike(kw)
                | func.replace(SongORM.title, " ", "").ilike(kw_no_space)
                | func.replace(SongORM.artist, " ", "").ilike(kw_no_space)
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

    async def find_sheets(self, song_id: UUID) -> list[SongSheet]:
        result = await self._db.execute(
            select(SongSheetORM)
            .where(SongSheetORM.song_id == song_id)
            .order_by(SongSheetORM.key, SongSheetORM.page_order)
        )
        return [_orm_to_sheet(r) for r in result.scalars().all()]

    async def save_sheet(self, sheet: SongSheet) -> SongSheet:
        new_row = SongSheetORM(
            id=sheet.id,
            song_id=sheet.song_id,
            key=sheet.key,
            sheet_url=sheet.sheet_url,
            page_order=sheet.page_order,
        )
        self._db.add(new_row)
        await self._db.commit()
        await self._db.refresh(new_row)
        return _orm_to_sheet(new_row)

    async def find_sheet_by_id(self, sheet_id: UUID) -> SongSheet | None:
        result = await self._db.execute(
            select(SongSheetORM).where(SongSheetORM.id == sheet_id)
        )
        row = result.scalar_one_or_none()
        return _orm_to_sheet(row) if row else None

    async def delete_sheet(self, sheet_id: UUID) -> None:
        result = await self._db.execute(
            select(SongSheetORM).where(SongSheetORM.id == sheet_id)
        )
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()

    async def delete_sheets_by_key(self, song_id: UUID, key: str) -> None:
        result = await self._db.execute(
            select(SongSheetORM).where(
                SongSheetORM.song_id == song_id,
                SongSheetORM.key == key,
            )
        )
        for row in result.scalars().all():
            await self._db.delete(row)
        await self._db.commit()


def _orm_to_post_song(row: PostSongORM) -> PostSong:
    return PostSong(
        id=row.id,
        post_id=row.post_id,
        song_id=row.song_id,
        order=row.order,
        ment=row.ment,
    )


def _orm_to_comment(row: CommentORM) -> Comment:
    return Comment(
        id=row.id,
        post_id=row.post_id,
        author_name=row.author_name,
        content=row.content,
        created_at=row.created_at,
    )


def _orm_to_post(row: PostORM) -> Post:
    return Post(
        id=row.id,
        author_name=row.author_name,
        scripture=row.scripture,
        meditation=row.meditation,
        view_count=row.view_count,
        created_at=row.created_at,
    )


class SQLAlchemyPostRepository(PostRepository):
    def __init__(self, db: AsyncSession):
        self._db = db

    async def save(self, post: Post) -> Post:
        row = PostORM(
            id=post.id,
            author_name=post.author_name,
            scripture=post.scripture,
            meditation=post.meditation,
            view_count=post.view_count,
            created_at=post.created_at,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_post(row)

    async def find_by_id(self, post_id: UUID) -> Post | None:
        result = await self._db.execute(select(PostORM).where(PostORM.id == post_id))
        row = result.scalar_one_or_none()
        return _orm_to_post(row) if row else None

    async def find_all(self, skip: int, limit: int, order_by: str) -> list[Post]:
        if order_by == "view":
            stmt = select(PostORM).order_by(PostORM.view_count.desc()).offset(skip).limit(limit)
        else:
            stmt = select(PostORM).order_by(PostORM.created_at.desc()).offset(skip).limit(limit)
        result = await self._db.execute(stmt)
        return [_orm_to_post(row) for row in result.scalars().all()]

    async def increment_view(self, post_id: UUID) -> None:
        result = await self._db.execute(select(PostORM).where(PostORM.id == post_id))
        row = result.scalar_one_or_none()
        if row:
            row.view_count += 1
            await self._db.commit()

    async def delete(self, post_id: UUID) -> None:
        result = await self._db.execute(select(PostORM).where(PostORM.id == post_id))
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()

    async def save_post_song(self, post_song: PostSong) -> PostSong:
        row = PostSongORM(
            id=post_song.id,
            post_id=post_song.post_id,
            song_id=post_song.song_id,
            order=post_song.order,
            ment=post_song.ment,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_post_song(row)

    async def find_post_songs(self, post_id: UUID) -> list[PostSong]:
        result = await self._db.execute(
            select(PostSongORM)
            .where(PostSongORM.post_id == post_id)
            .order_by(PostSongORM.order)
        )
        return [_orm_to_post_song(r) for r in result.scalars().all()]

    async def delete_post_song(self, post_song_id: UUID) -> None:
        result = await self._db.execute(select(PostSongORM).where(PostSongORM.id == post_song_id))
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()

    async def reorder_post_songs(self, post_id: UUID, song_ids: list[UUID]) -> list[PostSong]:
        for i, ps_id in enumerate(song_ids):
            result = await self._db.execute(
                select(PostSongORM).where(PostSongORM.id == ps_id, PostSongORM.post_id == post_id)
            )
            row = result.scalar_one_or_none()
            if row:
                row.order = i
        await self._db.commit()
        return await self.find_post_songs(post_id)

    async def save_comment(self, comment: Comment) -> Comment:
        row = CommentORM(
            id=comment.id,
            post_id=comment.post_id,
            author_name=comment.author_name,
            content=comment.content,
            created_at=comment.created_at,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return _orm_to_comment(row)

    async def find_comments(self, post_id: UUID) -> list[Comment]:
        result = await self._db.execute(
            select(CommentORM)
            .where(CommentORM.post_id == post_id)
            .order_by(CommentORM.created_at.asc())
        )
        return [_orm_to_comment(r) for r in result.scalars().all()]

    async def delete_comment(self, comment_id: UUID) -> None:
        result = await self._db.execute(select(CommentORM).where(CommentORM.id == comment_id))
        row = result.scalar_one_or_none()
        if row:
            await self._db.delete(row)
            await self._db.commit()
