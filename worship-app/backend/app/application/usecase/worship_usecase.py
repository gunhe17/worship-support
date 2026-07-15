from uuid import UUID

from app.common.exception.exceptions import raise_app_error
from app.domain.entity.worship import Worship
from app.domain.repository.worship_repository import WorshipRepository
from app.presentation.dto.worship_dto import WorshipCreateRequest, WorshipResponse, WorshipUpdateRequest


class WorshipUsecase:
    def __init__(self, repo: WorshipRepository):
        self._repo = repo

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
        updated = await self._repo.update(worship)
        return WorshipResponse.model_validate(updated)

    async def delete(self, worship_id: UUID) -> None:
        worship = await self._repo.find_by_id(worship_id)
        if not worship:
            raise_app_error("WORSHIP_NOT_FOUND")
        await self._repo.delete(worship_id)
