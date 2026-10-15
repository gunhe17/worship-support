"""연구 지도 사이드바 곡 목록(bpm-songs.json). (Playground 페이지 bpm-experiment.html은 2026-10-14에 뺐다)

  python lab/_server/build_bpm_experiment.py
bpm-songs.json = 찬양 500곡 {id, title, team, bpm}. bpm = lab/to-bpm/_tempo/tempo.py (Beat This! + DBN 마디).
"""
import json, sys, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
BPM = HERE.parent / "to-bpm"
sys.path.insert(0, str(BPM / "_tempo"))
from tempo import tempo  # noqa: E402

SRC = next(BPM.glob("*/bpm-model-sweep")) / "results/a/out/A/w500"
W500 = next(BPM.glob("*/bpm-pipeline")) / "results/worship500-v1/out/worship500.json"

songs = []
for x in json.load(open(W500)):
    p = SRC / f"{x['id']}.json"
    if not p.exists():
        continue
    m = json.load(open(p))["methods"].get("beatthis_final0_dbn") or {}
    b, d = m.get("beats") or [], m.get("downbeats") or []
    r = tempo(b, d)
    if not r:
        continue
    nfc = lambda t: unicodedata.normalize("NFC", t)  # 원본 제목은 NFD라 한글 검색이 안 맞는다
    songs.append({"id": x["id"], "team": nfc(x["team"]), "title": nfc(x["title"]), "bpm": r["bpm"],
                  "beats": [round(t, 3) for t in b], "downs": [round(t, 3) for t in d]})
songs.sort(key=lambda s: (s["team"], s["title"]))
data = json.dumps(songs, ensure_ascii=False, separators=(",", ":"))
# 연구 지도 사이드바 곡 목록 (to BPM 페이지 공통)
(HERE / "bpm-songs.json").write_text(json.dumps([{k: s[k] for k in ("id", "title", "team", "bpm")} for s in songs], ensure_ascii=False, separators=(",", ":")))
print("bpm-songs.json", len(songs), "곡")
