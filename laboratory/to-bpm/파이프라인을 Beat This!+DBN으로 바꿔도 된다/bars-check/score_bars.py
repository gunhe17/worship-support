"""gt-sweep 곡별 JSON의 박·첫 박 출력으로 마디를 채점한다 (새 추론 없음). 표준 라이브러리만.

  python score_bars.py   → 표 출력

박자 = 마디당 박 수 최빈값이 정답과 같은 곡 비율. 마디 길이 = 마디 길이 중앙값이 정답 ±4% 안인 곡 비율.
정답 마디 일치 = 정답 마디의 시작·끝이 둘 다 추정 첫 박 ±70ms 안인 비율. 연속 2박 = 2박 마디가 이어진 곡(정답이 2박이 아닌 곡).
찬양 듣기 확인(8곡)은 클릭 페이지(지금은 뺌)로 했다. 들은 곡·판정은 heard.json.
"""
import glob, json, statistics as st
from collections import Counter, defaultdict
from pathlib import Path

RES = next(Path(__file__).resolve().parents[2].glob("*/gt-sweep")) / "results"
BAD = {"slakh_Track00112", "slakh_Track00209", "slakh_Track01995", "slakh_Track01533"}  # gt-sweep rescore.py와 같음
M = ["beatthis_final0", "beatthis_final0_dbn", "beatthis_small0", "madmom_dbn", "beatnet"]


def bars(b, d):
    return [(a, z, sum(a - 0.05 <= x < z - 0.05 for x in b)) for a, z in zip(d, d[1:])]


songs = {}
for f in glob.glob(f"{RES}/*/out/*/*/*.json"):
    k = (f.split("/")[-2], f.split("/")[-1][:-5])
    if k[1] in BAD:
        continue
    try:
        r = json.load(open(f))
    except ValueError:
        continue
    s = songs.setdefault(k, {"m": {}})
    s["m"].update(r["methods"])
    s["gt"] = s.get("gt") or r.get("gt")

R = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
for (sset, sid), s in songs.items():
    grp = "rwc" if sset.startswith("rwc") else "slakh"
    gb = bars(s["gt"]["beats"], s["gt"]["downs"])
    if len(gb) < 4:
        continue
    gm = Counter(n for *_, n in gb).most_common(1)[0][0]
    gl = st.median(z - a for a, z, _ in gb)
    for m in M:
        e = s["m"].get(m) or {}
        if len(e.get("downbeats", [])) < 4:
            continue
        eb = bars(e["beats"], e["downbeats"])
        em = Counter(n for *_, n in eb).most_common(1)[0][0]
        D = e["downbeats"]
        hit = lambda t: any(abs(t - x) <= 0.07 for x in D)
        r = R[grp][m]
        r["meter"].append(em == gm)
        r["barlen"].append(abs(st.median(z - a for a, z, _ in eb) / gl - 1) <= 0.04)
        r["bar_hit"].append(sum(hit(a) and hit(z) for a, z, _ in gb) / len(gb))
        r["dbl"].append(gm != 2 and any(n1 == 2 and n2 == 2 for (*_, n1), (*_, n2) in zip(eb, eb[1:])))

for grp in ("rwc", "slakh"):
    print(f"== {grp}")
    print(f"  {'method':22} 박자   마디길이±4%  정답마디일치  연속2박")
    for m in M:
        r = R[grp][m]
        avg = lambda k: sum(r[k]) / len(r[k])
        print(f"  {m:22} {avg('meter'):.3f}  {avg('barlen'):.3f}        {avg('bar_hit'):.3f}         {avg('dbl'):.3f}  n={len(r['meter'])}")
