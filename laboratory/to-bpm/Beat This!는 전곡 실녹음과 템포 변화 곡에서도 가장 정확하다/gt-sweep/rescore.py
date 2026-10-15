"""커널이 곡별 JSON에 넣은 점수를 다시 모은다. 정답이 틀린 곡을 빼고, 상위 방법을 Beat This! final0과 곡 단위로 짝지어 비교한다. 표준 라이브러리만.

  python rescore.py   → results/rescore.json, 표 출력

템포 Acc1: 정확 McNemar (어긋난 곡만 이항검정, 양측). 구간 템포·박 F: 짝 부트스트랩 평균 차 95% 구간 (10,000회, seed 0).
"""
import json, math, random
from pathlib import Path

RES = Path(__file__).parent / "results"
# 14개 방법이 모두 틀리는 곡 = 정답 쪽 문제
BAD_GT = {
    "slakh_Track00112": "템포 정보 없는 MIDI의 기본값 120 (모든 방법 박 F ≈ 0.23)",
    "slakh_Track00209": "템포 정보 없는 MIDI의 기본값 120 (모든 방법 박 F ≈ 0.24)",
    "slakh_Track01995": "템포 정보 없는 MIDI의 기본값 120 (모든 방법 박 F ≈ 0.23)",
    "slakh_Track01533": "템포는 모두 맞는데 박 F ≈ 0.03: 음원·MIDI 오프셋",
}
BASE = "beatthis_final0"
VS = ["beatthis_final0_dbn", "beatthis_small0", "madmom_dbn", "ess_tempocnn", "deeprhythm"]
METRICS = ["acc1", "local1", "beat_f"]


def load():
    songs = {}
    for f in RES.glob("*/out/*/*/*.json"):
        try:
            row = json.load(open(f))
        except ValueError:
            continue
        s = songs.setdefault((f.parent.name, f.stem), {"s": {}})
        s["s"].update(row.get("scores", {}))
        if row.get("gt") and "change" not in s:
            b = row["gt"]["beats"]
            loc = [60 / sorted(y - x for x, y in zip(b[i:i + 9], b[i + 1:i + 9]))[3] for i in range(0, len(b) - 8, 4)]
            s["change"] = max(loc) / min(loc) > 1.04  # build_bpm_song.py와 같은 기준
    return songs


def mcnemar(a, b):
    """a만 맞은 곡 수, b만 맞은 곡 수 → 양측 정확 p."""
    n = a + b
    if not n:
        return 1.0
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(min(a, b) + 1)) / 2 ** n)


def boot(d, rng):
    m = [sum(rng.choices(d, k=len(d))) / len(d) for _ in range(10000)]
    m.sort()
    return round(sum(d) / len(d), 3), round(m[249], 3), round(m[9749], 3)


def compare(rows):
    out = {"n": len(rows), "mean": {}, "vs": {}}
    for k in [BASE] + VS:
        out["mean"][k] = {m: round(sum(float(r[k][m]) for r in rows if m in r.get(k, {})) / max(1, sum(m in r.get(k, {}) for r in rows)), 3)
                          for m in METRICS if any(m in r.get(k, {}) for r in rows)}
    rng = random.Random(0)
    for k in VS:
        both = [r for r in rows if BASE in r and k in r]
        a = sum(r[BASE]["acc1"] and not r[k]["acc1"] for r in both)
        b = sum(r[k]["acc1"] and not r[BASE]["acc1"] for r in both)
        v = {"acc1": {"base_only": a, "other_only": b, "p": round(mcnemar(a, b), 3)}}
        for m in ("local1", "beat_f"):
            d = [r[k][m] - r[BASE][m] for r in both if m in r[k]]
            if d:
                v[m] = dict(zip(("diff", "lo", "hi"), boot(d, rng)))  # 양수 = 상대 방법이 낫다
        out["vs"][k] = v
    return out


if __name__ == "__main__":
    songs = load()
    groups = {}
    for (sset, sid), s in songs.items():
        if sid in BAD_GT:
            groups.setdefault("slakh-excluded", []).append(s["s"])
            continue
        groups.setdefault(sset, []).append(s["s"])
        if sset == "slakh":
            groups.setdefault("slakh-change" if s["change"] else "slakh-steady", []).append(s["s"])
    out = {"excluded": BAD_GT, "groups": {g: compare(rows) for g, rows in sorted(groups.items()) if g != "slakh-excluded"}}
    (RES / "rescore.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for g, o in out["groups"].items():
        print(f"\n== {g} (n={o['n']})")
        for k, v in o["mean"].items():
            print(f"  {k:22}", "  ".join(f"{m}={x:.3f}" for m, x in v.items()))
        for k, v in o["vs"].items():
            a = v["acc1"]
            s = "  ".join(f"{m} {x['diff']:+.3f} [{x['lo']:+.3f},{x['hi']:+.3f}]" for m, x in v.items() if m != "acc1")
            print(f"  vs {k:19} acc1 {a['base_only']}:{a['other_only']} p={a['p']:.3f}  {s}")
