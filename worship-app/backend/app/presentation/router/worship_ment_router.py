import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.database import get_db
from app.infrastructure.orm.worship_ment_orm import WorshipMentORM
from app.presentation.dto.worship_ment_dto import (
    BatchSaveMentsRequest,
    BatchSaveMentsResponse,
    DeleteMentResponse,
    WorshipMentItem,
    WorshipMentListResponse,
)

router = APIRouter(prefix="/api/v1/ments", tags=["WorshipMent"])


@router.get("/{worship_id}", response_model=WorshipMentListResponse)
async def get_ments(worship_id: str, db: AsyncSession = Depends(get_db)) -> WorshipMentListResponse:
    """예배의 전체 멘트 목록 조회 (텔레프롬프터용)"""
    result = await db.execute(
        select(WorshipMentORM)
        .where(WorshipMentORM.worship_id == uuid.UUID(worship_id))
        .order_by(WorshipMentORM.order)
    )
    rows = result.scalars().all()
    return WorshipMentListResponse(
        worship_id=worship_id,
        ments=[
            WorshipMentItem(
                id=str(r.id),
                song_title=r.song_title,
                section_label=r.section_label,
                ment_text=r.ment_text,
                order=r.order,
            )
            for r in rows
        ],
    )


@router.post("/batch", response_model=BatchSaveMentsResponse)
async def batch_save_ments(
    body: BatchSaveMentsRequest, db: AsyncSession = Depends(get_db)
) -> BatchSaveMentsResponse:
    """예배의 멘트 전체를 일괄 저장 (기존 데이터 교체)"""
    worship_uuid = uuid.UUID(body.worship_id)

    await db.execute(delete(WorshipMentORM).where(WorshipMentORM.worship_id == worship_uuid))

    for item in body.ments:
        db.add(
            WorshipMentORM(
                id=uuid.UUID(item.id) if item.id else uuid.uuid4(),
                worship_id=worship_uuid,
                song_title=item.song_title,
                section_label=item.section_label,
                ment_text=item.ment_text,
                order=item.order,
            )
        )

    await db.commit()
    return BatchSaveMentsResponse(worship_id=body.worship_id, saved_count=len(body.ments))


@router.delete("/{ment_id}", response_model=DeleteMentResponse)
async def delete_ment(ment_id: str, db: AsyncSession = Depends(get_db)) -> DeleteMentResponse:
    """단일 멘트 삭제"""
    result = await db.execute(
        delete(WorshipMentORM).where(WorshipMentORM.id == uuid.UUID(ment_id))
    )
    await db.commit()
    return DeleteMentResponse(deleted=result.rowcount > 0)
