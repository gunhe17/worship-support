from uuid import UUID

from app.common.exception.exceptions import raise_app_error
from app.domain.entity.song_arrangement import SongArrangement
from app.domain.entity.worship import Worship
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository
from app.presentation.dto.worship_dto import (
    ArrangementBulkItem,
    ArrangementCreateRequest,
    ArrangementResponse,
    ArrangementUpdateRequest,
    SectionSummary,
    WorshipCreateRequest,
    WorshipResponse,
    WorshipUpdateRequest,
)


class WorshipUsecase:
    def __init__(self, repo: WorshipRepository, song_repo: SongRepository | None = None):
        self._repo = repo
        self._song_repo = song_repo

    async def create(self, req: WorshipCreateRequest) -> WorshipResponse:
        worship = Worship(
            title=req.title,
            scripture=req.scripture,
            sermon_direction=req.sermon_direction,
            duration_minutes=req.duration_minutes,
        )
        saved = await self._repo.save(worship)
        return WorshipResponse.model_validate(saved)

    async def list_all(self, skip: int, limit: int) -> list[WorshipResponse]:
        worships = await self._repo.find_all(skip, limit)
        return [WorshipResponse.model_validate(w) for w in worships]

    async def get(self, worship_id: UUID) -> WorshipResponse:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        return WorshipResponse.model_validate(worship)

    async def update(self, worship_id: UUID, req: WorshipUpdateRequest) -> WorshipResponse:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        if req.title is not None:
            worship.title = req.title
        if req.scripture is not None:
            worship.scripture = req.scripture
        if req.sermon_direction is not None:
            worship.sermon_direction = req.sermon_direction
        if req.duration_minutes is not None:
            worship.duration_minutes = req.duration_minutes
        if req.leader_meditation is not None:
            worship.leader_meditation = req.leader_meditation
        updated = await self._repo.update(worship)
        return WorshipResponse.model_validate(updated)

    async def delete(self, worship_id: UUID) -> None:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        await self._repo.delete(worship_id)

    # ── Arrangement ───────────────────────────────────────────────────────────

    async def _build_arr_response(self, arr: SongArrangement) -> ArrangementResponse:
        song_title = ""
        song_artist = ""
        song_bpm = 80
        song_key = arr.key or ""
        song_sheet_url: str | None = None
        sections: list[SectionSummary] = []

        if self._song_repo:
            song = await self._song_repo.find_by_id(arr.song_id)
            if song:
                song_title = song.title
                song_artist = song.artist
                song_bpm = song.bpm if song.bpm and song.bpm > 0 else 80
                if not song_key:
                    song_key = song.default_key or ""
                raw_sections = await self._song_repo.find_sections(arr.song_id)
                sections = [
                    SectionSummary(
                        id=s.id,
                        section_type=s.section_type,
                        section_label=s.section_label,
                        order=s.order,
                    )
                    for s in raw_sections
                ]
                # find the per-key sheet matching this arrangement's key
                sheets = await self._song_repo.find_sheets(arr.song_id)
                matched = next((s for s in sheets if s.key == song_key), None)
                if matched:
                    song_sheet_url = matched.sheet_url

        return ArrangementResponse(
            id=arr.id,
            worship_id=arr.worship_id,
            song_id=arr.song_id,
            order=arr.order,
            song_form=arr.song_form,
            ment=arr.ment,
            sheet_url=arr.sheet_url,
            song_title=song_title,
            song_artist=song_artist,
            song_bpm=song_bpm,
            song_key=song_key,
            song_sheet_url=song_sheet_url,
            sections=sections,
        )

    async def list_arrangements(self, worship_id: UUID) -> list[ArrangementResponse]:
        arrs = await self._repo.find_arrangements(worship_id)
        return [await self._build_arr_response(a) for a in arrs]

    async def add_arrangement(self, worship_id: UUID, req: ArrangementCreateRequest) -> ArrangementResponse:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        arr = SongArrangement(
            worship_id=worship_id,
            song_id=req.song_id,
            order=req.order,
            song_form=req.song_form,
            ment=req.ment,
            key="",
            tempo=0,
            memo="",
        )
        saved = await self._repo.save_arrangement(arr)
        return await self._build_arr_response(saved)

    async def update_arrangement(self, arr_id: UUID, req: ArrangementUpdateRequest) -> ArrangementResponse:
        arr = await self._repo.find_arrangement_by_id(arr_id)
        if not arr:
            raise_app_error("ARRANGEMENT_NOT_FOUND")
        if req.song_form is not None:
            arr.song_form = req.song_form
        if req.ment is not None:
            arr.ment = req.ment
        if req.order is not None:
            arr.order = req.order
        if req.sheet_url is not None:
            arr.sheet_url = req.sheet_url
        updated = await self._repo.update_arrangement(arr)
        return await self._build_arr_response(updated)

    async def delete_arrangement(self, arr_id: UUID) -> None:
        arr = await self._repo.find_arrangement_by_id(arr_id)
        if not arr:
            raise_app_error("ARRANGEMENT_NOT_FOUND")
        await self._repo.delete_arrangement(arr_id)

    async def bulk_add_arrangements(
        self, worship_id: UUID, items: list[ArrangementBulkItem]
    ) -> list[ArrangementResponse]:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        results = []
        for item in items:
            arr = SongArrangement(
                worship_id=worship_id,
                song_id=item.song_id,
                order=item.order,
                song_form=item.song_form,
                ment=item.ment,
                key="",
                tempo=0,
                memo="",
            )
            saved = await self._repo.save_arrangement(arr)
            results.append(await self._build_arr_response(saved))
        return results
