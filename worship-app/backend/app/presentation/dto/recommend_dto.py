from pydantic import BaseModel


class ScriptureAnalysisRequest(BaseModel):
    scripture: str
    worship_type: str = "청년예배"


class ScriptureAnalysisResponse(BaseModel):
    themes: list[str]
    keywords: list[str]
    storyline: str
    emotional_flow: list[str]


class SongRecommendRequest(BaseModel):
    scripture: str
    themes: list[str]
    worship_type: str = "청년예배"
    count: int = 5


class YoutubeResult(BaseModel):
    title: str
    url: str
    channel: str
    thumbnail: str = ""


class SongRecommendItem(BaseModel):
    title: str
    artist: str
    reason: str
    recommended_key: str = ""
    bpm: int = 0
    mood: str = ""
    estimated_duration_minutes: float = 0.0
    song_form: list[str] = []
    connection_to_prev: str = ""
    connection_note: str = ""
    youtube_links: list[YoutubeResult] = []


class SongRecommendResponse(BaseModel):
    recommendations: list[SongRecommendItem]


# 한 번에 본문 분석 + 곡 추천 + YouTube 검색을 수행하는 통합 요청
class FullRecommendRequest(BaseModel):
    worship_id: str
    scripture: str
    sermon_direction: str = ""
    duration_minutes: int = 30
    worship_type: str = "청년예배"
    count: int = 5
    force_refresh: bool = False


class FullRecommendResponse(BaseModel):
    worship_id: str
    analysis: ScriptureAnalysisResponse
    recommendations: list[SongRecommendItem]
    total_estimated_duration: float


class KeyRecommendRequest(BaseModel):
    song_id: str
    vocal_type: str
    congregation_type: str


class KeyRecommendResponse(BaseModel):
    recommended_keys: list[str]
    reason: str


class SongFormRecommendRequest(BaseModel):
    song_id: str
    worship_context: str


class SongFormRecommendResponse(BaseModel):
    song_form: list[str]
    reason: str


class TempoRecommendRequest(BaseModel):
    song_id: str
    worship_context: str


class TempoRecommendResponse(BaseModel):
    recommended_bpm: int
    range: dict[str, int]
    reason: str


class MentRecommendRequest(BaseModel):
    worship_id: str
    position: str  # intro | transition | outro


class MentRecommendResponse(BaseModel):
    ment: str
    alternatives: list[str]


class SectionMentRecommendRequest(BaseModel):
    song_title: str
    section_from: str       # e.g. "Chorus", "Intro", "Bridge"
    section_to: str         # e.g. "Bridge", "Verse", "Outro"
    bars_from: int = 8      # 현재 섹션 마디 수
    bars_to: int = 8        # 다음 섹션 마디 수
    scripture: str
    theme: str
    worship_type: str = "청년예배"


class SectionMentRecommendResponse(BaseModel):
    ment: str
    alternatives: list[str]


class SongFormSectionItem(BaseModel):
    name: str   # e.g. "Intro", "Verse", "Chorus"
    bars: int   # 마디 수


class SongFormWithBarsRequest(BaseModel):
    song_title: str
    artist: str
    bpm: int = 90
    worship_type: str = "청년예배"
    available_minutes: float = 5.0  # 이 곡에 배정된 예배 시간


class SongFormWithBarsResponse(BaseModel):
    sections: list[SongFormSectionItem]
    total_estimated_minutes: float
