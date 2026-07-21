import asyncio
import re

import httpx

from app.common.config.settings import settings

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

ARTIST_ALIASES: dict[str, list[str]] = {
    "마커스워십":   ["markers", "마커스"],
    "welove":       ["welove", "위러브"],
    "위러브":       ["welove", "위러브"],
    "f.i.a":        ["fia", "f i a", "피아"],
    "피아":         ["fia", "f i a", "피아"],
    "제이어스":     ["j us", "제이어스", "jus"],
    "어노인팅":     ["anointing", "어노인팅"],
    "온누리워십":   ["onnuri", "온누리"],
    "소리엘":       ["sorijel", "소리엘"],
    "예수전도단":   ["예수전도단", "ywam"],
    "다윗의장막":   ["다윗의장막"],
    "시와그림":     ["시와그림"],
    "화나":         ["화나", "hwana"],
    "강찬":         ["강찬"],
    "워십메이커스": ["worshipmakers", "워십메이커스"],
}


def _normalize(text: str) -> str:
    return re.sub(r"[^\w가-힣]", " ", text.lower()).strip()


def _is_clearly_wrong(video_title: str, channel: str, song_title: str, artist: str) -> bool:
    """완전히 관계없는 영상인지만 체크 (느슨한 필터)."""
    vt = _normalize(video_title)
    vc = _normalize(channel)

    # 곡 제목 토큰 (2자 이상)
    title_tokens = [w for w in _normalize(song_title).split() if len(w) >= 2]

    # 아티스트 토큰
    artist_key = _normalize(artist)
    artist_tokens = {artist_key}
    for k, aliases in ARTIST_ALIASES.items():
        if k in artist_key or artist_key in k:
            artist_tokens.update(_normalize(a) for a in aliases)
    artist_tokens.update(w for w in artist_key.split() if len(w) >= 2)

    # 곡 제목 단어 하나라도 포함되면 OK
    title_hit = any(w in vt for w in title_tokens)
    # 아티스트가 영상 제목 또는 채널에 포함되면 OK
    artist_hit = any(t in vt or t in vc for t in artist_tokens if t)

    # 둘 다 없으면 완전히 관계없는 영상
    return not title_hit and not artist_hit


class YoutubeClient:
    def _to_result(self, item: dict) -> dict:
        return {
            "title": item["snippet"]["title"],
            "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
            "channel": item["snippet"]["channelTitle"],
            "thumbnail": item["snippet"]["thumbnails"]["default"]["url"],
        }

    async def _fetch(self, query: str, max_results: int = 8) -> list[dict]:
        async with httpx.AsyncClient(trust_env=False, timeout=10.0) as client:
            resp = await client.get(
                YOUTUBE_SEARCH_URL,
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": max_results,
                    "key": settings.YOUTUBE_API_KEY,
                    "relevanceLanguage": "ko",
                },
            )
            resp.raise_for_status()
            return resp.json().get("items", [])

    async def search_by_song(
        self,
        title: str,
        artist: str,
        search_query: str = "",
    ) -> list[dict]:
        if not title.strip():
            return []

        try:
            if search_query.strip():
                # Claude가 제공한 정확한 검색어 → YouTube 상위 결과를 신뢰
                # 완전히 관계없는 영상만 제거
                items = await self._fetch(search_query.strip())
                results = [
                    self._to_result(item) for item in items
                    if not _is_clearly_wrong(
                        item["snippet"]["title"],
                        item["snippet"]["channelTitle"],
                        title, artist,
                    )
                ]
                if results:
                    return results[:3]

            # 검색어 없거나 결과 없을 때 → 곡명+아티스트 기본 쿼리로 재시도
            items = await self._fetch(f"{title} {artist} 찬양")
            results = [
                self._to_result(item) for item in items
                if not _is_clearly_wrong(
                    item["snippet"]["title"],
                    item["snippet"]["channelTitle"],
                    title, artist,
                )
            ]
            return results[:3]

        except Exception:
            return []

    async def search_multiple(self, songs: list[dict]) -> list[list[dict]]:
        tasks = [
            self.search_by_song(
                s.get("title", ""),
                s.get("artist", ""),
                s.get("youtube_search_query", ""),
            )
            for s in songs
        ]
        return await asyncio.gather(*tasks)
