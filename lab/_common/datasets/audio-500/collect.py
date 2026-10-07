"""찬양 음원 500곡 수집 (개인 연구용, 비공개). yt-dlp만 사용.

  python collect.py list       # 채널 업로드 목록 → 필터 → songs.json (500곡)
  python collect.py download   # songs.json → audio/<id>.<ext>
  python collect.py refill     # download.log의 "Video unavailable" 곡을 같은 팀 다음 순위 곡으로 교체
"""
import collections, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
N = 500
PER_TEAM = 30  # ponytail: 팀당 상한. 채널 수가 늘면 낮춤

CHANNELS = {  # 팀 → 공식 채널 (검색 결과에서 눈으로 확인, Topic·모음 채널 제외)
    "마커스워십": "UCrnxDS-QclED-ej-MFxr8tA",
    "어노인팅": "UCqZ6R9Js2HG-6ZNP71soeUg",
    "제이어스": "UCvD9bnpjlzv2gVA_cQ1ESNg",
    "위러브": "UCP7ZxuXP4w6TODC_np5Q_IA",
    "예수전도단 화요모임": "UCn5qdSP9lz6BIl4bPwM41qg",
    "예수전도단 캠퍼스워십": "UCB6oCUPiiKkXcmjORXe9R6w",
    "피아워십": "UCmDCtLeqOzF7_uf_UXoNiYA",
    "아이자야씩스티원": "UCCJMY5J7tSmopE6kuRNs1Zw",
    "레위지파": "UCaTL5Hq8WdrGKibZ0qNY-LA",
    "옹기장이": "UCujB5Oh0mCufksAmtdl-DBw",
    "팀룩": "UCs8bogrlfyKhAOTywkR9o6w",
    "히즈윌": "UCky3SPg9kg32B-jdZ8VVWpA",
    "뉴제너레이션워십": "UCsBpGALUyAUY3qJZdenPgTA",
    "한마음찬양": "UCYy28Xx6geqWVUF2sN4bSMA",
    "브리지임팩트": "UCZQNzBSxTPjsQgZLfOb-Akg",
    "부흥한국": "UCJ3ts8sMgCvz1FJwVFTK4Yg",
    "천관웅": "UCPxzc-RstJjazv_WkHRXJFg",
    "좋은씨앗": "UCakbrm-QQqBkLtZ2mgxwV7Q",
    "소리엘": "UCCRY6weG5j8XPjOkmgylSug",
    "김브라이언": "UCef6FpB7jL5OZVOJxN9EHjQ",
    "예람워십": "UCWgyCh92781HaX_ue0r8Vng",
    "손경민": "UCIyvPLWipoYrkutcssIoJnA",
    "한웅재": "UCabV6VVaf-1HMYtagk0DLeg",
}

EXCLUDE = re.compile(r"\bmr\b|inst|반주|instrumental|shorts|#short|멘트|기도|설교|말씀|"
                     r"full|풀영상|연속|모음|playlist|플레이리스트|1시간|hour|teaser|티저|"
                     r"behind|비하인드|interview|인터뷰|live stream|생방송|예배실황 전체|"
                     r"piano cover|커버|cover|kids|키즈|eng ver|english|일본어|japanese", re.I)


def ytdlp(*args):
    out = subprocess.run(["yt-dlp", "--flat-playlist", "-J", "--no-warnings", *args],
                         capture_output=True, text=True)
    return json.loads(out.stdout) if out.stdout.strip() else {"entries": []}


def norm(t):
    return re.sub(r"[\W_]+", "", re.sub(r"\(.*?\)|\[.*?\]|【.*?】|\|.*", "", t)).lower()


def pools():
    pools = {}
    for team, cid in CHANNELS.items():
        info = ytdlp(f"https://www.youtube.com/channel/{cid}/videos")
        ents, channel = info["entries"], info.get("channel")
        seen, keep = set(), []
        for e in sorted(ents, key=lambda e: -(e.get("view_count") or 0)):
            d, t = e.get("duration") or 0, e.get("title") or ""
            if not 150 <= d <= 720 or EXCLUDE.search(t) or norm(t) in seen:
                continue
            seen.add(norm(t))
            keep.append({"id": e["id"], "team": team, "title": t, "channel": channel,
                         "duration": d, "views": e.get("view_count"),
                         "url": f"https://www.youtube.com/watch?v={e['id']}"})
        pools[team] = keep
        print(f"{team}: {len(ents)} uploads -> {len(keep)} kept", flush=True)
    return pools


def listing():
    pools = {t: p[:PER_TEAM] for t, p in globals()["pools"]().items()}
    # 팀별 조회수 순위대로 돌아가며 뽑기 (한 팀 쏠림 방지)
    songs = []
    for rank in range(PER_TEAM):
        for team in pools:
            if rank < len(pools[team]) and len(songs) < N:
                songs.append(pools[team][rank])
    (HERE / "songs.json").write_text(json.dumps(songs, ensure_ascii=False, indent=1))
    print(len(songs), "songs", collections.Counter(s["team"] for s in songs))


def download():
    songs = json.loads((HERE / "songs.json").read_text())
    (HERE / "urls.txt").write_text("\n".join(s["url"] for s in songs))
    subprocess.run(["yt-dlp", "-f", "bestaudio", "-a", str(HERE / "urls.txt"),
                    "-o", str(HERE / "audio/%(id)s.%(ext)s"),
                    "--download-archive", str(HERE / "audio/archive.txt"),
                    "--sleep-interval", "2", "--max-sleep-interval", "6",
                    "--ignore-errors", "--no-warnings"])


def refill():
    songs = json.loads((HERE / "songs.json").read_text())
    log = (HERE / "download.log").read_text()
    bad = set(re.findall(r"ERROR: \[youtube\] ([\w-]{11}): Video unavailable", log))
    gone = [s for s in songs if s["id"] in bad]
    songs = [s for s in songs if s["id"] not in bad]
    used = {s["id"] for s in songs} | bad
    pool = pools()
    for g in gone:  # 같은 팀 다음 순위, 없으면 남은 후보가 가장 많은 팀
        cand = [c for c in pool[g["team"]] if c["id"] not in used] or \
               max(([c for c in p if c["id"] not in used] for p in pool.values()), key=len)
        songs.append(cand[0])
        used.add(cand[0]["id"])
        print("replace", g["team"], g["id"], "->", cand[0]["team"], cand[0]["id"], cand[0]["title"][:50])
    (HERE / "songs.json").write_text(json.dumps(songs, ensure_ascii=False, indent=1))
    print(len(songs), "songs")


if __name__ == "__main__":
    {"list": listing, "download": download, "refill": refill}[sys.argv[1]]()
