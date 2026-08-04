from uuid import UUID

from fastapi import APIRouter, Depends

from app.application.usecase.worship_usecase import WorshipUsecase
from app.common.dependencies import get_worship_repo
from app.domain.repository.worship_repository import WorshipRepository
from app.infrastructure.external.llm.claude_client import ClaudeClient
from app.presentation.dto.worship_dto import (
    WorshipCreateRequest,
    WorshipFromTextRequest,
    WorshipResponse,
    WorshipUpdateRequest,
)

router = APIRouter(prefix="/api/v1/worship", tags=["Worship"])


def get_usecase(repo: WorshipRepository = Depends(get_worship_repo)) -> WorshipUsecase:
    return WorshipUsecase(repo)


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
