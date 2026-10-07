# Build results/report.html from Kaggle result JSONs: model outputs only, compared against each other (no reference values, no grading).
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R3, R4 = ROOT / "results/kaggle-v3/results", ROOT / "results/kaggle-v4/results"
load = lambda p: json.loads(p.read_text()) if p.exists() and p.stat().st_size else None

SONGS = [
    {
        "id": "markers", "team": "마커스워십", "title": "주님의 사랑", "file": "markers_love-of-god",
        "window": "180초", "dir": R4,
    },
    {
        "id": "anointing", "team": "어노인팅", "title": "주 안에서 기뻐해", "file": "anointing_rejoice",
        "window": "180초", "dir": R4,
    },
    {
        "id": "jus", "team": "제이어스", "title": "여호와께 돌아가자", "file": "jus_return-to-lord",
        "window": "420초", "dir": R3,
    },
]

for s in SONGS:
    d, f = s.pop("dir"), s["file"]
    s["mix"], s["stems"] = load(d / f"{f}.json"), load(d / f"{f}.stems.json")
    s["seg180"], s["seg420"] = load(d / f"{f}.segments.w180.json"), load(d / f"{f}.segments.w420.json")
    stt = {}
    # v2 overrides v1 for the same model/input (ghost613 v1 failed with a config error)
    for p in sorted((ROOT / "results/stt-v1/stt").glob(f"{f}.*.json")) + sorted((ROOT / "results/stt-v2/stt").glob(f"{f}.*.json")):
        j = load(p)
        name = {"whisper-large-v3": "whisper-large-v3 (VAD)", "whisper-large-v3-novad": "whisper-large-v3 (VAD 없음)"}.get(j["model"], j["model"]) if j else None
        if j: stt.setdefault(name, {})[j["input"]] = {"text": j["text"], "segments": [{k: x[k] for k in ("start", "end", "text")} for x in j["segments"]]}
    s["stt"] = stt or None

html = (ROOT / "scripts/report_template.html").read_text().replace("/*__DATA__*/null", json.dumps(SONGS, ensure_ascii=False).replace("\ufffd", "\\ufffd"))  # keep raw U+FFFD from model output as a JS escape
(ROOT / "results/report.html").write_text(html)
print("wrote results/report.html", len(html))
