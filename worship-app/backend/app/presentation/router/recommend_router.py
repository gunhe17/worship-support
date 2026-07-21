from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.usecase.recommend_usecase import RecommendUsecase
from app.common.dependencies import get_worship_repo
from app.domain.repository.worship_repository import WorshipRepository
from app.infrastructure.db.database import get_db
from app.infrastructure.external.llm.claude_client import ClaudeClient
from app.infrastructure.external.youtube.youtube_client import YoutubeClient
from app.presentation.dto.recommend_dto import (
    FullRecommendRequest,
    FullRecommendResponse,
    KeyRecommendRequest,
    KeyRecommendResponse,
    MentRecommendRequest,
    MentRecommendResponse,
    ScriptureAnalysisRequest,
    ScriptureAnalysisResponse,
    SectionMentRecommendRequest,
    SectionMentRecommendResponse,
    SongFormRecommendRequest,
    SongFormRecommendResponse,
    SongFormWithBarsRequest,
    SongFormWithBarsResponse,
    SongRecommendRequest,
    SongRecommendResponse,
    TempoRecommendRequest,
    TempoRecommendResponse,
)

router = APIRouter(prefix="/api/v1/recommend", tags=["Recommend"])

_llm = ClaudeClient()
_youtube = YoutubeClient()


def get_usecase() -> RecommendUsecase:
    return RecommendUsecase(llm=_llm, youtube=_youtube)


def get_usecase_with_repo(
    worship_repo: WorshipRepository = Depends(get_worship_repo),
) -> RecommendUsecase:
    return RecommendUsecase(llm=_llm, youtube=_youtube, worship_repo=worship_repo)


@router.post("/worship", response_model=FullRecommendResponse)
async def full_recommend(
    body: FullRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase_with_repo),
) -> FullRecommendResponse:
    """예배 생성 후 자동으로 본문 분석 + 곡 추천 + YouTube 검색을 한 번에 수행합니다. DB 캐시 우선."""
    return await usecase.full_recommend(body)


@router.post("/scripture", response_model=ScriptureAnalysisResponse)
async def analyze_scripture(
    body: ScriptureAnalysisRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> ScriptureAnalysisResponse:
    return await usecase.analyze_scripture(body)


@router.post("/song", response_model=SongRecommendResponse)
async def recommend_song(
    body: SongRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> SongRecommendResponse:
    return await usecase.recommend_song(body)


@router.post("/key", response_model=KeyRecommendResponse)
async def recommend_key(
    body: KeyRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> KeyRecommendResponse:
    return await usecase.recommend_key(body)


@router.post("/songform", response_model=SongFormRecommendResponse)
async def recommend_song_form(
    body: SongFormRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> SongFormRecommendResponse:
    return await usecase.recommend_song_form(body)


@router.post("/tempo", response_model=TempoRecommendResponse)
async def recommend_tempo(
    body: TempoRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> TempoRecommendResponse:
    return await usecase.recommend_tempo(body)


@router.post("/ment", response_model=MentRecommendResponse)
async def recommend_ment(
    body: MentRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> MentRecommendResponse:
    return await usecase.recommend_ment(body)


@router.post("/section-ment", response_model=SectionMentRecommendResponse)
async def recommend_section_ment(
    body: SectionMentRecommendRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> SectionMentRecommendResponse:
    """섹션 전환 시 인도자 멘트 AI 추천 (마디 수 컨텍스트 포함)"""
    return await usecase.recommend_section_ment(body)


@router.post("/song-form-bars", response_model=SongFormWithBarsResponse)
async def recommend_song_form_with_bars(
    body: SongFormWithBarsRequest,
    usecase: RecommendUsecase = Depends(get_usecase),
) -> SongFormWithBarsResponse:
    """예배 배정 시간에 맞춰 송폼과 각 섹션 마디 수를 AI 추천"""
    return await usecase.recommend_song_form_with_bars(body)
