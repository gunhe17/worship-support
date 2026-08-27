import asyncio
import os
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from supabase import create_client

from app.application.usecase.song_usecase import SongUsecase
from app.common.dependencies import get_song_repo
from app.common.exception.exceptions import raise_app_error
from app.domain.repository.song_repository import SongRepository
from app.presentation.dto.song_dto import (
    SectionReorderRequest,
    SongCreateRequest,
    SongResponse,
    SongSectionCreateRequest,
    SongSectionResponse,
    SongSectionUpdateRequest,
    SongSheetResponse,
    SongUpdateRequest,
)

SUPABASE_BUCKET = "sheets"


def _upload_sheet_sync(content: bytes, filename: str, content_type: str) -> str:
    from app.common.config.settings import settings as _settings
    client = create_client(_settings.SUPABASE_URL, _settings.SUPABASE_KEY)
    client.storage.from_(SUPABASE_BUCKET).upload(
        path=filename, file=content, file_options={"content-type": content_type}
    )
    return client.storage.from_(SUPABASE_BUCKET).get_public_url(filename)

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


# ── 키별 악보(Sheet) 엔드포인트 ──────────────────────────────────────────────────

@router.get("/{song_id}/sheets", response_model=list[SongSheetResponse])
async def list_sheets(
    song_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> list[SongSheetResponse]:
    return await usecase.list_sheets(song_id)


@router.post("/{song_id}/sheets", response_model=SongSheetResponse, status_code=201)
async def upload_song_sheet(
    song_id: UUID,
    key: str = Form(...),
    file: UploadFile = File(...),
    usecase: SongUsecase = Depends(get_usecase),
) -> SongSheetResponse:
    import re
    song = await usecase._repo.find_by_id(song_id)
    raw_title = song.title if song else ""
    ascii_title = re.sub(r'[^a-zA-Z0-9]', '_', raw_title)
    ascii_title = re.sub(r'_+', '_', ascii_title).strip('_')
    short_id = str(song_id)[:8]
    safe_base = f"{ascii_title}_{key}" if ascii_title else f"{key}_{short_id}"
    ext = os.path.splitext(file.filename or "")[-1]
    unique_suffix = str(uuid4())[:8]
    filename = f"{safe_base}_{unique_suffix}{ext}"
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    try:
        sheet_url = await asyncio.to_thread(_upload_sheet_sync, content, filename, content_type)
    except Exception:
        import traceback
        traceback.print_exc()
        raise_app_error("STORAGE_ERROR")
    return await usecase.upload_sheet(song_id, key, sheet_url)


@router.delete("/{song_id}/sheets/{sheet_id}", status_code=204)
async def delete_song_sheet(
    song_id: UUID,
    sheet_id: UUID,
    usecase: SongUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete_sheet(song_id, sheet_id)
