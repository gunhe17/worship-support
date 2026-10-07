# CER of per-section STT against reference lyrics transcribed from sheet music (refs/lyrics/<id>.txt).
# Performance order != sheet order and choruses repeat, so each crop is aligned semi-globally:
# the hypothesis must be fully consumed, but it may match any contiguous span of the reference (free start/end).
# CER = edit distance / length of the matched reference span.
# "Vocal crops" = crops where at least one model reaches CER < 0.5 (excludes instrumental crops without lyrics).
import json, re, sys
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parent.parent
M = ["whisper-large-v3", "whisper-turbo-ko-ghost613", "qwen3-asr-1.7b"]
norm = lambda t: re.sub(r"[^가-힣a-zA-Z0-9]", "", t or "")

def ref_text(p):
    lines = [l for l in p.read_text().splitlines() if l.strip() and not l.strip().startswith(("[", "#"))]
    r = norm("".join(lines))
    return r + r  # doubled so a crop spanning the end->start wrap (e.g. last chorus -> verse 1) still aligns

def semiglobal(h, r):
    """min edit distance of h against any substring of r; returns (dist, span_len)."""
    if not h: return None
    n, m = len(h), len(r)
    prev = [0] * (m + 1); pst = list(range(m + 1))  # free start: row 0 is all zeros, start = j
    for i in range(1, n + 1):
        cur = [i] + [0] * m; cst = [0] + [0] * m
        for j in range(1, m + 1):
            c = prev[j - 1] + (h[i - 1] != r[j - 1]); s = pst[j - 1]
            if prev[j] + 1 < c: c, s = prev[j] + 1, pst[j]          # h char unmatched (insertion in hyp)
            if cur[j - 1] + 1 < c: c, s = cur[j - 1] + 1, cst[j - 1]  # ref char skipped (deletion)
            cur[j], cst[j] = c, s
        prev, pst = cur, cst
    j = min(range(m + 1), key=lambda k: prev[k])  # free end
    return prev[j], max(1, j - pst[j])

def crop_cers(sections, r):
    """per-section {model: {input: CER or None}}; None when the crop has no lyric match for any model (instrumental)."""
    out = []
    for g in sections:
        d = {}
        for inp in ("mix", "vocals"):
            cer = {}
            for m in M:
                a = semiglobal(norm(g["stt"][m][inp]), r)
                cer[m] = None if a is None else a[0] / a[1]
            vocal = min((c for c in cer.values() if c is not None), default=9) < 0.5
            for m in M:
                d.setdefault(m, {})[inp] = (1.0 if cer[m] is None else min(cer[m], 3.0)) if vocal else None
        out.append(d)
    return out

if __name__ == "__main__":
    res = {m: {"mix": [], "vocals": []} for m in M}
    per_song = {}
    for rp in sorted((ROOT / "refs/lyrics").glob("*.txt")):
        sid = rp.stem; r = ref_text(rp)
        v1 = json.loads((ROOT / f"results/kaggle-v1/out/{sid}.json").read_text())
        g6 = json.loads((ROOT / f"results/kaggle-ghost613/out/{sid}.ghost613.json").read_text())
        song = {m: {"mix": [], "vocals": []} for m in M}
        for i, g in enumerate(v1["sections"]):
            g["stt"]["whisper-turbo-ko-ghost613"] = g6[str(i)]
            for inp in ("mix", "vocals"):
                cer = {}
                for m in M:
                    h = norm(g["stt"][m][inp])
                    a = semiglobal(h, r)
                    cer[m] = None if a is None else a[0] / a[1]
                if min((c for c in cer.values() if c is not None), default=9) < 0.5:
                    for m in M:
                        c = 1.0 if cer[m] is None else min(cer[m], 3.0)  # empty on a vocal crop = full error; cap runaway loops
                        song[m][inp].append(c); res[m][inp].append(c)
        per_song[sid] = song

    print(f"songs with reference lyrics: {len(per_song)}  ({', '.join(per_song)})")
    print(f"\n{'model':<28}{'input':<8}{'crops':>6}{'mean CER':>10}{'median':>8}")
    for m in M:
        for inp in ("vocals", "mix"):
            x = res[m][inp]
            if x: print(f"{m:<28}{inp:<8}{len(x):>6}{mean(x):>10.3f}{median(x):>8.3f}")
    print(f"\nper song, median CER on vocals input")
    print(f"{'song':<28}" + "".join(f"{m.split('-')[0][:7]+('-g' if 'ghost' in m else ''):>12}" for m in M))
    for sid, s in per_song.items():
        print(f"{sid:<28}" + "".join(f"{median(s[m]['vocals']) if s[m]['vocals'] else float('nan'):>12.3f}" for m in M))
    if "--json" in sys.argv:
        json.dump({"overall": {m: {k: {"n": len(v), "mean": mean(v), "median": median(v)} for k, v in d.items() if v} for m, d in res.items()},
                   "per_song": {sid: {m: {k: median(v) for k, v in d.items() if v} for m, d in s.items()} for sid, s in per_song.items()}},
                  open(ROOT / "results/cer.json", "w"), indent=1)
