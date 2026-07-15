from fastapi import APIRouter, Query

from app.infrastructure.external.youtube.youtube_client import YoutubeClient

router = APIRouter(prefix="/api/v1/youtube", tags=["YouTube"])

_client = YoutubeClient()


@router.get("/search")
async def search_youtube(
    title: str = Query(..., description="곡 제목"),
    artist: str = Query("", description="아티스트"),
) -> list[dict]:
    return await _client.search_by_song(title, artist)
