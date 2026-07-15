import asyncio
import re

import httpx

from app.common.config.settings import settings

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def _normalize(text: str) -> str:
    """비교용: 소문자화 + 특수문자 제거."""
    return re.sub(r"[^\w가-힣]", " ", text.lower())


def _is_relevant(video_title: str, song_title: str, artist: str) -> bool:
    """
    YouTube 결과 영상이 실제 추천 곡과 관련 있는지 확인합니다.
    곡 제목의 주요 단어 또는 아티스트명이 영상 제목에 포함되어야 합니다.
    """
    vt = _normalize(video_title)

    # 곡 제목에서 2자 이상 단어만 추출
    song_words = [w for w in _normalize(song_title).split() if len(w) >= 2]
    # 아티스트명 전체 또는 분리 단어
    artist_words = [w for w in _normalize(artist).split() if len(w) >= 2]

    # 곡 제목 단어 중 하나 이상이 영상 제목에 있으면 관련 있음
    title_match = sum(1 for w in song_words if w in vt)
    artist_match = any(w in vt for w in artist_words)

    # 제목 단어 50% 이상 매칭(최소 2단어) 또는 아티스트 매칭
    if song_words:
        ratio_ok = (title_match / len(song_words)) >= 0.5 and title_match >= 2
        return ratio_ok or artist_match
    return artist_match


class YoutubeClient:
    async def search_by_song(self, title: str, artist: str) -> list[dict]:
        """곡 제목과 아티스트로 YouTube 영상을 검색하고 관련성 필터를 적용합니다."""
        if not title.strip():
            return []

        # 더 구체적인 쿼리: 곡명 + 아티스트명으로 정확도 향상
        query = f'"{title}" {artist} 찬양'
        try:
            async with httpx.AsyncClient(trust_env=False, timeout=10.0) as client:
                resp = await client.get(
                    YOUTUBE_SEARCH_URL,
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": 8,  # 필터링 후 3개 남기기 위해 더 많이 가져옴
                        "key": settings.YOUTUBE_API_KEY,
                        "relevanceLanguage": "ko",
                    },
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])

                results = []
                for item in items:
                    video_title = item["snippet"]["title"]
                    # 관련성 필터: 영상 제목에 곡명 또는 아티스트가 포함되어야 함
                    if _is_relevant(video_title, title, artist):
                        results.append({
                            "title": video_title,
                            "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
                            "channel": item["snippet"]["channelTitle"],
                            "thumbnail": item["snippet"]["thumbnails"]["default"]["url"],
                        })

                # 관련 영상이 없으면 빈 결과 반환 (틀린 영상 표시보다 직접 검색 링크가 낫다)
                return results[:3]
        except Exception:
            return []

    async def search_multiple(self, songs: list[dict]) -> list[list[dict]]:
        """여러 곡을 동시에 검색합니다."""
        tasks = [self.search_by_song(s.get("title", ""), s.get("artist", "")) for s in songs]
        return await asyncio.gather(*tasks)
