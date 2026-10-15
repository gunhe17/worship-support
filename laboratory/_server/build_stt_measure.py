"""STT Test 페이지(stt-measure.html): 찬양 500곡의 Whisper large-v3 받아쓰기를 곡마다 시각·가사 줄로 나열한다.

  python lab/_server/build_stt_measure.py   → serve.py로 http://127.0.0.1:8000/_server/stt-measure.html

입력: lab/to-arrangement-form/_stt-500/results/out/<id>.json (Kaggle worship-stt-500). 가사는 저작물이라 이 페이지도 git에서 뺀다.
환각 의심 = 노래와 무관하게 여러 곡에 반복되는 자막·인사 문구 (README 참고). 지우지 않고 표시만 한다.
"""
import json, re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "to-arrangement-form/_stt-500/results/out"
HALL = re.compile(r"자막|\bby\b|시청|구독|좋아요|다음 영상|영상에서|감사합니다\.?$|MBC|KBS|SBS")

songs = []
for f in sorted(OUT.glob("*.json")):
    d = json.load(open(f))
    segs = [[s, e, t, int(bool(HALL.search(t)))] for s, e, t in d["segments"] if t]
    songs.append({"id": d["id"], "team": d["team"], "title": d["title"], "dur": d["dur"], "seg": segs})
data = json.dumps({"songs": songs}, ensure_ascii=False, separators=(",", ":"))
(HERE / "stt-measure.html").write_text((HERE / "stt-measure.template.html").read_text().replace("__DATA__", data))
print("stt-measure.html", len(songs), "songs", sum(len(s["seg"]) for s in songs), "lines",
      sum(x[3] for s in songs for x in s["seg"]), "hallucination-suspect", len(data) // 1024, "KB")
