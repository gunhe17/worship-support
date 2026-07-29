from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.application.usecase.song_usecase import SongUsecase
from app.common.dependencies import get_song_repo
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

router = APIRouter(prefix="/api/v1/songs", tags=["Song"])


def get_usecase(repo: SongRepository = Depends(get_song_repo)) -> SongUsecase:
    return SongUsecase(repo)


@router.get("", response_model=list[SongResponse])
async def list_songs(
    skip: int = 0,
    limit: int = 20,
    usecase: SongUsecase = Depends(get_usecase),
) -> list[SongResponse]:
    return await usecase.list_all(skip, limit)


@router.get("/search", response_model=list[SongResponse])
async def search_songs(
    q: str = Query(..., description="검색 키워드"),
    usecase: SongUsecase = Depends(get_usecase),
) -> list[SongResponse]:
    return await usecase.search(q)


@router.get("/{song_id}", response_model=SongResponse)
async def get_song(
    song_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> SongResponse:
    return await usecase.get_by_id(song_id)


@router.post("", response_model=SongResponse, status_code=201)
async def create_song(
    body: SongCreateRequest,
    usecase: SongUsecase = Depends(get_usecase),
) -> SongResponse:
    return await usecase.create(body)


@router.put("/{song_id}", response_model=SongResponse)
async def update_song(
    song_id: UUID,
    body: SongUpdateRequest,
    usecase: SongUsecase = Depends(get_usecase),
) -> SongResponse:
    return await usecase.update(song_id, body)


@router.delete("/{song_id}", status_code=204)
async def delete_song(
    song_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete(song_id)


# ── 구간(Section) 엔드포인트 ──────────────────────────────────────────────────

@router.get("/{song_id}/sections", response_model=list[SongSectionResponse])
async def list_sections(
    song_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> list[SongSectionResponse]:
    return await usecase.list_sections(song_id)


@router.post("/{song_id}/sections", response_model=SongSectionResponse, status_code=201)
async def add_section(
    song_id: UUID,
    body: SongSectionCreateRequest,
    usecase: SongUsecase = Depends(get_usecase),
) -> SongSectionResponse:
    return await usecase.add_section(song_id, body)


@router.put("/{song_id}/sections/reorder", response_model=list[SongSectionResponse])
async def reorder_sections(
    song_id: UUID,
    body: SectionReorderRequest,
    usecase: SongUsecase = Depends(get_usecase),
) -> list[SongSectionResponse]:
    return await usecase.reorder_sections(song_id, body)


@router.put("/{song_id}/sections/{section_id}", response_model=SongSectionResponse)
async def update_section(
    song_id: UUID,
    section_id: UUID,
    body: SongSectionUpdateRequest,
    usecase: SongUsecase = Depends(get_usecase),
) -> SongSectionResponse:
    return await usecase.update_section(song_id, section_id, body)


@router.delete("/{song_id}/sections/{section_id}", status_code=204)
async def delete_section(
    song_id: UUID,
    section_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete_section(song_id, section_id)
