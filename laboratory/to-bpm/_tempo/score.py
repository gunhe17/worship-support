"""tempo()를 gt-sweep의 Beat This!+DBN 출력에 대 보고 정답 템포와 비교한다 (새 추론 없음).

  python score.py   → 곡 전체·32박 창별 ±1/2/4% 정답률

정답 템포 = 정답 박 간격 중앙값 (gt-sweep 채점과 같음). 32박 창 = 정답 박 32개(4/4 8마디)마다 자른 구간.
±1%는 믿지 말 것: RWC 정답 박은 대부분 10ms 단위라 정답 템포가 계단값이고(0.5초 박이면 한 칸 2%), 추정값이 ±1% 경계에 몰린다.
tempo()의 0.1 BPM 반올림만으로 RWC 32박 창 ±1%가 0.906 → 0.865로 흔들린다. 비교는 ±2%로 한다.
"""
import glob, json, math, statistics as st
from pathlib import Path
from tempo import tempo

RES = next(Path(__file__).resolve().parents[1].glob("*/gt-sweep")) / "results"
BAD = {"slakh_Track00112", "slakh_Track00209", "slakh_Track01995", "slakh_Track01533"}  # 정답 불량 (gt-sweep rescore.py)
M, WIN = "beatthis_final0_dbn", 32

songs = {}
for f in glob.glob(f"{RES}/a/out/A/*/*.json"):
    sset, sid = f.split("/")[-2], f.split("/")[-1][:-5]
    if sid in BAD:
        continue
    try:
        r = json.load(open(f))
    except ValueError:
        continue
    if r.get("gt") and M in r["methods"]:
        songs[(sset, sid)] = (r["gt"], r["methods"][M])

err = {}
for (sset, _), (gt, m) in songs.items():
    grp = "rwc" if sset.startswith("rwc") else "slakh"
    gb = gt["beats"]
    spans = [("song", gb[0], gb[-1], gt["tempo"])]
    spans += [("win", gb[i], gb[i + WIN], 60 / st.median([b - a for a, b in zip(gb[i:i + WIN], gb[i + 1:i + WIN + 1])]))
              for i in range(0, len(gb) - WIN, WIN)]
    for lvl, t0, t1, truth in spans:
        inside = lambda xs: [x for x in xs if t0 - 0.05 <= x <= t1 + 0.05]
        r = tempo(inside(m["beats"]), inside(m["downbeats"]))
        if r:
            err.setdefault((lvl, grp), []).append((math.log(r["bpm"] / truth), r["method"]))

for (lvl, grp), v in sorted(err.items()):
    acc = lambda tol: sum(abs(e) <= math.log(1 + tol) for e, _ in v) / len(v)
    bars = sum(k == "bars" for _, k in v) / len(v)
    print(f"{lvl:5} {grp:6} n={len(v):5}  ±1% {acc(.01):.3f}  ±2% {acc(.02):.3f}  ±4% {acc(.04):.3f}  마디로 계산 {bars:.0%}")
