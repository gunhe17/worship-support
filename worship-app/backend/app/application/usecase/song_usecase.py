from uuid import UUID

from app.common.exception.exceptions import raise_app_error
from app.domain.entity.song import Song
from app.domain.repository.song_repository import SongRepository
from app.presentation.dto.song_dto import SongCreateRequest, SongResponse, SongUpdateRequest


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

    async def update(self, song_id: UUID, req: SongUpdateRequest) -> SongResponse:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        for field, val in req.model_dump(exclude_none=True).items():
            setattr(song, field, val)
        updated = await self._repo.update(song)
        return SongResponse.model_validate(updated)

    async def delete(self, song_id: UUID) -> None:
        song = await self._repo.find_by_id(song_id)
        if not song:
            raise_app_error("SONG_NOT_FOUND")
        await self._repo.delete(song_id)
