"""Boundary 페이지(boundary-measure.html): 공개 300곡 마디 경계 시험(boundary-bench). Test와 같은 틀 — 재생 + 방법별 마디 띠.

  python3 _server/build_boundary_measure.py   → serve.py로 http://127.0.0.1:8000 (To Arrangement Form › Boundary)

입력: boundary-bench results/v2/out/<id>.json. 커널 안에서 계산한 값을 옮겨 담기만 한다.
출력: boundary-measure.html + boundary-songs.json (연구 지도 사이드바 곡 목록). 음원은 serve.py /sfb/<id>가 HF에서 받아 둔다.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
RES = next((HERE.parent / "to-arrangement-form").glob("*/boundary-bench")) / "results/v2"
SET = {"HarmonixSet": "영어", "CN": "중국어"}

songs = []
for f in sorted((RES / "out").glob("*.json")):
    d = json.loads(f.read_text())
    grids = {}
    for grid, methods in d["grids"].items():
        first = next(v for k, v in methods.items() if not k.startswith("_"))
        grids[grid] = {"db": methods["_downbeats"], "ref": first["reference_bars"],
                       "m": {k: {"bars": v["bars"], "f1": v["bar1"][2], "f0": v["bar0"][2]} for k, v in methods.items() if not k.startswith("_")}}
    songs.append({"id": d["id"], "subset": d["subset"], "dur": round(d["duration"], 1), "grids": grids})
data = json.dumps({"songs": songs}, ensure_ascii=False, separators=(",", ":"))
(HERE / "boundary-measure.html").write_text((HERE / "boundary-measure.template.html").read_text().replace("__DATA__", data))
listing = [{"id": s["id"], "title": s["id"], "team": f"{SET[s['subset']]} · {len(s['grids']['beat-this']['db']) - 1}마디"} for s in songs]
(HERE / "boundary-songs.json").write_text(json.dumps(listing, ensure_ascii=False))
print("boundary-measure.html", len(songs), "songs", len(data) // 1024, "KB")
