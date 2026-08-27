import asyncio
import os
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File
from supabase import create_client

from app.application.usecase.worship_usecase import WorshipUsecase
from app.common.dependencies import get_song_repo, get_worship_repo
from app.common.exception.exceptions import raise_app_error
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository
from app.infrastructure.external.llm.claude_client import ClaudeClient
from app.presentation.dto.worship_dto import (
    ArrangementBulkItem,
    ArrangementCreateRequest,
    ArrangementResponse,
    ArrangementUpdateRequest,
    WorshipCreateRequest,
    WorshipFromTextRequest,
    WorshipResponse,
    WorshipUpdateRequest,
)

router = APIRouter(prefix="/api/v1/worship", tags=["Worship"])

SUPABASE_BUCKET = "sheets"


def _upload_sheet_sync(content: bytes, filename: str, content_type: str) -> str:
    from app.common.config.settings import settings as _settings
    client = create_client(_settings.SUPABASE_URL, _settings.SUPABASE_KEY)
    _ensure_bucket(client)
    try:
        client.storage.from_(SUPABASE_BUCKET).remove([filename])
    except Exception:
        pass
    client.storage.from_(SUPABASE_BUCKET).upload(
        path=filename,
        file=content,
        file_options={"content-type": content_type},
    )
    return client.storage.from_(SUPABASE_BUCKET).get_public_url(filename)


def get_usecase(
    repo: WorshipRepository = Depends(get_worship_repo),
    song_repo: SongRepository = Depends(get_song_repo),
) -> WorshipUsecase:
    return WorshipUsecase(repo, song_repo)


@router.post("/from-text", response_model=WorshipResponse, status_code=201)
async def create_worship_from_text(
    body: WorshipFromTextRequest,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> WorshipResponse:
    extracted = await ClaudeClient().extract_worship_info(body.raw_text)
    create_req = WorshipCreateRequest(
        title=extracted.get("title", "예배"),
        scripture=extracted.get("scripture", ""),
        sermon_direction=extracted.get("sermon_direction") or "",
        duration_minutes=body.duration_minutes,
    )
    return await usecase.create(create_req)


@router.post("", response_model=WorshipResponse, status_code=201)
async def create_worship(
    body: WorshipCreateRequest,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> WorshipResponse:
    return await usecase.create(body)


@router.get("", response_model=list[WorshipResponse])
async def list_worship(
    skip: int = 0,
    limit: int = 20,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> list[WorshipResponse]:
    return await usecase.list_all(skip, limit)


@router.get("/{worship_id}", response_model=WorshipResponse)
async def get_worship(
    worship_id: UUID,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> WorshipResponse:
    return await usecase.get(worship_id)


@router.put("/{worship_id}", response_model=WorshipResponse)
async def update_worship(
    worship_id: UUID,
    body: WorshipUpdateRequest,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> WorshipResponse:
    return await usecase.update(worship_id, body)


@router.delete("/{worship_id}", status_code=204)
async def delete_worship(
    worship_id: UUID,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete(worship_id)


# ── Arrangement (콘티) ────────────────────────────────────────────────────────

@router.get("/{worship_id}/arrangements", response_model=list[ArrangementResponse])
async def list_arrangements(
    worship_id: UUID,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> list[ArrangementResponse]:
    return await usecase.list_arrangements(worship_id)


@router.post("/{worship_id}/arrangements", response_model=ArrangementResponse, status_code=201)
async def add_arrangement(
    worship_id: UUID,
    body: ArrangementCreateRequest,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> ArrangementResponse:
    return await usecase.add_arrangement(worship_id, body)


@router.put("/{worship_id}/arrangements/{arr_id}", response_model=ArrangementResponse)
async def update_arrangement(
    worship_id: UUID,
    arr_id: UUID,
    body: ArrangementUpdateRequest,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> ArrangementResponse:
    return await usecase.update_arrangement(arr_id, body)


@router.delete("/{worship_id}/arrangements/{arr_id}", status_code=204)
async def delete_arrangement(
    worship_id: UUID,
    arr_id: UUID,
    usecase: WorshipUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete_arrangement(arr_id)


@router.post("/{worship_id}/arrangements/bulk", response_model=list[ArrangementResponse], status_code=201)
async def bulk_add_arrangements(
    worship_id: UUID,
    body: list[ArrangementBulkItem],
    usecase: WorshipUsecase = Depends(get_usecase),
) -> list[ArrangementResponse]:
    return await usecase.bulk_add_arrangements(worship_id, body)


@router.post("/{worship_id}/arrangements/{arr_id}/sheet", response_model=ArrangementResponse)
async def upload_sheet(
    worship_id: UUID,
    arr_id: UUID,
    file: UploadFile = File(...),
    usecase: WorshipUsecase = Depends(get_usecase),
) -> ArrangementResponse:
    ext = os.path.splitext(file.filename or "")[-1]
    filename = f"{arr_id}{ext}"
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    try:
        sheet_url = await asyncio.to_thread(_upload_sheet_sync, content, filename, content_type)
    except Exception:
        raise_app_error("STORAGE_ERROR")
    return await usecase.update_arrangement(arr_id, ArrangementUpdateRequest(sheet_url=sheet_url))
