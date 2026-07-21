from uuid import UUID

from app.domain.repository.worship_repository import WorshipRepository
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
    SongFormSectionItem,
    SongFormWithBarsRequest,
    SongFormWithBarsResponse,
    SongRecommendItem,
    SongRecommendRequest,
    SongRecommendResponse,
    TempoRecommendRequest,
    TempoRecommendResponse,
    YoutubeResult,
)


class RecommendUsecase:
    def __init__(self, llm: ClaudeClient, youtube: YoutubeClient, worship_repo: WorshipRepository | None = None):
        self._llm = llm
        self._youtube = youtube
        self._worship_repo = worship_repo

    async def analyze_scripture(self, req: ScriptureAnalysisRequest) -> ScriptureAnalysisResponse:
        result = await self._llm.analyze_scripture(req.scripture, req.worship_type)
        return ScriptureAnalysisResponse(**result)

    async def recommend_song(self, req: SongRecommendRequest) -> SongRecommendResponse:
        ai_recs = await self._llm.recommend_songs(
            req.scripture, req.themes, req.worship_type, req.count
        )
        yt_results = await self._youtube.search_multiple(ai_recs)
        recommendations = []
        for song, yt_links in zip(ai_recs, yt_results):
            recommendations.append(
                SongRecommendItem(
                    title=song.get("title", ""),
                    artist=song.get("artist", ""),
                    reason=song.get("reason", ""),
                    recommended_key=song.get("recommended_key", ""),
                    bpm=song.get("bpm", 0),
                    song_form=song.get("song_form", []),
                    youtube_links=[YoutubeResult(**yt) for yt in yt_links[:3]],
                )
            )
        return SongRecommendResponse(recommendations=recommendations)

    async def full_recommend(self, req: FullRecommendRequest) -> FullRecommendResponse:
        """본문 분석 + 곡 추천(분위기 패턴+연결) + YouTube 검색을 한 번에 수행. DB 캐시 우선."""
        # 0. DB에 저장된 결과가 있으면 바로 반환 (force_refresh=True면 재분석)
        if self._worship_repo and req.worship_id and not req.force_refresh:
            try:
                worship = await self._worship_repo.find_by_id(UUID(req.worship_id))
                if worship and worship.ai_result:
                    return FullRecommendResponse(**worship.ai_result)
            except Exception:
                pass

        # 1. 성경 본문 분석 (설교 방향성 포함)
        analysis_result = await self._llm.analyze_scripture(
            req.scripture, req.worship_type, req.sermon_direction
        )
        analysis = ScriptureAnalysisResponse(**analysis_result)

        # 2. 분위기 패턴 + 곡 연결 + 예배 시간 고려 선곡 (설교 방향성 포함)
        ai_recs = await self._llm.recommend_songs_full(
            scripture=req.scripture,
            themes=analysis.themes,
            worship_type=req.worship_type,
            duration_minutes=req.duration_minutes,
            count=req.count,
            sermon_direction=req.sermon_direction,
        )

        # 제목 또는 아티스트가 없는 항목 제거 (AI 응답 불완전 방어)
        ai_recs = [r for r in ai_recs if r.get("title", "").strip() and r.get("artist", "").strip()]

        # 3. YouTube 병렬 검색
        yt_results = await self._youtube.search_multiple(ai_recs)

        # 4. 결합
        recommendations = []
        for song, yt_links in zip(ai_recs, yt_results):
            recommendations.append(
                SongRecommendItem(
                    title=song.get("title", ""),
                    artist=song.get("artist", ""),
                    reason=song.get("reason", ""),
                    recommended_key=song.get("recommended_key", ""),
                    bpm=song.get("bpm", 0),
                    mood=song.get("mood", ""),
                    estimated_duration_minutes=float(song.get("estimated_duration_minutes", 0)),
                    song_form=song.get("song_form", []),
                    connection_to_prev=song.get("connection_to_prev", ""),
                    connection_note=song.get("connection_note", ""),
                    youtube_links=[YoutubeResult(**yt) for yt in yt_links[:3]],
                )
            )

        total_duration = sum(s.estimated_duration_minutes for s in recommendations)

        response = FullRecommendResponse(
            worship_id=req.worship_id,
            analysis=analysis,
            recommendations=recommendations,
            total_estimated_duration=round(total_duration, 1),
        )

        # 5. 결과 DB에 저장 (다음 요청부터 캐시 반환)
        if self._worship_repo and req.worship_id:
            try:
                await self._worship_repo.save_ai_result(
                    UUID(req.worship_id),
                    response.model_dump(),
                )
            except Exception:
                pass

        return response

    async def recommend_key(self, req: KeyRecommendRequest) -> KeyRecommendResponse:
        result = await self._llm.recommend_key(req.song_id, req.vocal_type, req.congregation_type)
        return KeyRecommendResponse(**result)

    async def recommend_song_form(self, req: SongFormRecommendRequest) -> SongFormRecommendResponse:
        result = await self._llm.recommend_song_form(req.song_id, req.worship_context)
        return SongFormRecommendResponse(**result)

    async def recommend_tempo(self, req: TempoRecommendRequest) -> TempoRecommendResponse:
        result = await self._llm.recommend_tempo(req.song_id, req.worship_context)
        return TempoRecommendResponse(**result)

    async def recommend_ment(self, req: MentRecommendRequest) -> MentRecommendResponse:
        result = await self._llm.recommend_ment(req.worship_id, req.position)
        return MentRecommendResponse(**result)

    async def recommend_section_ment(self, req: SectionMentRecommendRequest) -> SectionMentRecommendResponse:
        result = await self._llm.recommend_section_ment(
            song_title=req.song_title,
            section_from=req.section_from,
            section_to=req.section_to,
            bars_from=req.bars_from,
            bars_to=req.bars_to,
            scripture=req.scripture,
            theme=req.theme,
            worship_type=req.worship_type,
        )
        return SectionMentRecommendResponse(**result)

    async def recommend_song_form_with_bars(self, req: SongFormWithBarsRequest) -> SongFormWithBarsResponse:
        result = await self._llm.recommend_song_form_with_bars(
            song_title=req.song_title,
            artist=req.artist,
            bpm=req.bpm,
            worship_type=req.worship_type,
            available_minutes=req.available_minutes,
        )
        sections = [SongFormSectionItem(**s) for s in result.get("sections", [])]
        return SongFormWithBarsResponse(
            sections=sections,
            total_estimated_minutes=float(result.get("total_estimated_minutes", 0)),
        )
