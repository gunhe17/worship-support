from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


# #
# serve

class Handler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parents[2]), **kwargs)

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path != "/youtube":
            return super().do_GET()

        # find
        text = urllib.parse.parse_qs(url.query).get("q", [""])[0].strip()
        try:
            body = {"videos": find(text=text)}
        except urllib.error.HTTPError as error:
            body = {"error": json.load(error)["error"]["message"]}
        except (RuntimeError, urllib.error.URLError) as error:
            body = {"error": str(error)}

        # respond
        payload = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


# #
# query

# ponytail: 프로세스 메모리 캐시, 만료 없음. 서버를 다시 띄우면 비워진다
@lru_cache(maxsize=256)
def find(*, text: str) -> list[dict]:
    if not text:
        return []

    # link
    id = video_id(text=text)
    if id:
        return videos(ids=(id,))

    # search
    ids = search(query=text)
    found = videos(ids=ids)

    return found


def video_id(*, text: str) -> str | None:
    match = re.search(r"(?:youtu\.be/|[?&]v=|/shorts/|/embed/|/live/)([\w-]{11})", text)
    return match.group(1) if match else None


def search(*, query: str) -> tuple[str, ...]:
    response = _get(
        path="search",
        params={
            "part": "id",
            "type": "video",
            "maxResults": 10,
            "regionCode": "KR",
            "relevanceLanguage": "ko",
            "q": query,
        },
    )
    return tuple(
        item["id"]["videoId"] for item in response["items"]
    )


# search.list는 길이·조회수를 주지 않아 videos.list를 한 번 더 부른다
def videos(*, ids: tuple[str, ...]) -> list[dict]:
    if not ids:
        return []
    response = _get(
        path="videos",
        params={
            "part": "snippet,contentDetails,statistics",
            "id": ",".join(ids),
        },
    )
    items = {item["id"]: item for item in response["items"]}
    return [
        _video(item=items[id]) for id in ids if id in items
    ]


def _video(*, item: dict) -> dict:
    snippet = item["snippet"]
    statistics = item.get("statistics", {})
    return {
        "id": item["id"],
        "title": html.unescape(snippet["title"]),
        "channel": snippet["channelTitle"],
        "published_at": snippet["publishedAt"],
        "duration_seconds": _seconds(duration=item["contentDetails"]["duration"]),
        "view_count": (
            int(statistics["viewCount"]) if "viewCount" in statistics else None
        ),
    }


def _seconds(*, duration: str) -> int:
    match = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", duration)
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    return ((days * 24 + hours) * 60 + minutes) * 60 + seconds


# #
# request

def _get(*, path: str, params: dict) -> dict:
    key = os.environ.get("YOUTUBE_API_KEY") or _dotenv().get("YOUTUBE_API_KEY")
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY가 환경 변수에도 ui/.env에도 없습니다")
    query = urllib.parse.urlencode({**params, "key": key})
    with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/{path}?{query}", timeout=10) as response:
        return json.load(response)


def _dotenv() -> dict[str, str]:
    path = Path(__file__).resolve().parents[2] / ".env"
    if not path.exists():
        return {}
    pairs = (line.split("=", 1) for line in path.read_text().splitlines() if "=" in line and not line.startswith("#"))
    return {
        name.strip(): value.strip().strip("\"'") for name, value in pairs
    }


# #
# cli

if __name__ == "__main__":
    if sys.argv[1:2] == ["serve"]:
        # serve 0.0.0.0 이면 같은 네트워크의 다른 기기에서도 열린다
        host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
        print(f"http://{host}:8001/conti-song-add.html")
        ThreadingHTTPServer((host, 8001), Handler).serve_forever()
    else:
        print(json.dumps(find(text=" ".join(sys.argv[1:])), ensure_ascii=False, indent=2))
