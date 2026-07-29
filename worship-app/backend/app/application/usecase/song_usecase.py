from uuid import UUID

from app.common.exception.exceptions import raise_app_error
from app.domain.entity.song import Song
from app.domain.entity.song_section import SongSection
from app.domain.repository.song_repository import SongRepository
from app.presentation.dto.song_dto import (
    SectionReorderRequest,
    SongCreateRequest,
    SongResponse,
    SongSectionCreateRequest,
    SongSectionResponse,
    SongSectionUpdateRequest,
    SongUpdateRequest,
)


def _section_to_response(s: SongSection) -> SongSectionResponse:
    return SongSectionResponse(
        id=s.id,
        song_id=s.song_id,
        section_type=s.section_type,
        section_label=s.section_label,
        lyrics=s.lyrics,
        bars=s.bars,
        chord=s.chord,
        order=s.order,
    )


class SongUsecase:
    def __init__(self, repo: SongRepository):
        self._repo = repo

    async def create(self, req: SongCreateRequest) -> SongResponse:
        song = Song(
            title=req.title,
            artist=req.artist,
            default_key=req.default_key,
            bpm=req.bpm,
            category=req.category,
            lyrics=req.lyrics,
            sheet=req.sheet,
        )
        saved = await self._repo.save(song)
        return SongResponse.model_validate(saved)

    async def list_all(self, skip: int, limit: int) -> list[SongResponse]:
        songs = await self._repo.find_all(skip, limit)
        return [SongResponse.model_validate(s) for s in songs]

    async def search(self, keyword: str) -> list[SongResponse]:
        songs = await self._repo.search(keyword)
        return [SongResponse.model_validate(s) for s in songs]

    async def get_by_id(self, song_id: UUID) -> SongResponse:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        sections = await self._repo.find_sections(song_id)
        song.sections = sections
        return SongResponse.model_validate(song)

    async def update(self, song_id: UUID, req: SongUpdateRequest) -> SongResponse:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        for field, val in req.model_dump(exclude_none=True).items():
            setattr(song, field, val)
        updated = await self._repo.update(song)
        sections = await self._repo.find_sections(song_id)
        updated.sections = sections
        return SongResponse.model_validate(updated)

    async def delete(self, song_id: UUID) -> None:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        await self._repo.delete(song_id)

    async def list_sections(self, song_id: UUID) -> list[SongSectionResponse]:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        sections = await self._repo.find_sections(song_id)
        return [_section_to_response(s) for s in sections]

    async def add_section(self, song_id: UUID, req: SongSectionCreateRequest) -> SongSectionResponse:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        existing = await self._repo.find_sections(song_id)
        order = req.order if req.order != 0 else len(existing)
        section = SongSection(
            song_id=song_id,
            section_type=req.section_type,
            section_label=req.section_label,
            lyrics=req.lyrics,
            bars=req.bars,
            chord=req.chord,
            order=order,
        )
        saved = await self._repo.save_section(section)
        return _section_to_response(saved)

    async def update_section(
        self, song_id: UUID, section_id: UUID, req: SongSectionUpdateRequest
    ) -> SongSectionResponse:
        section = await self._repo.find_section_by_id(section_id)
        if not section or section.song_id != song_id:
            raise_app_error("SECTION_NOT_FOUND")
        for field, val in req.model_dump(exclude_none=True).items():
            setattr(section, field, val)
        updated = await self._repo.update_section(section)
        return _section_to_response(updated)

    async def delete_section(self, song_id: UUID, section_id: UUID) -> None:
        section = await self._repo.find_section_by_id(section_id)
        if not section or section.song_id != song_id:
            raise_app_error("SECTION_NOT_FOUND")
        await self._repo.delete_section(section_id)

    async def reorder_sections(
        self, song_id: UUID, req: SectionReorderRequest
    ) -> list[SongSectionResponse]:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        sections = await self._repo.reorder_sections(song_id, req.section_ids)
        return [_section_to_response(s) for s in sections]
