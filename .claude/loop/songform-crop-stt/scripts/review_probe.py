# Probe: does per-section STT carry enough signal to identify song form?
# For each song: model agreement per section, hallucination flags, lyric-repeat groups vs SongFormer labels.
import json, re, sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "results/kaggle-v1/out"
HALLU = ["한글자막", "자막 by", "감사합니다", "안녕하세요", "시청", "구독", "자막", "영상", "여러분", "좋아요", "MBC", "KBS"]
norm = lambda t: re.sub(r"[^가-힣a-zA-Z0-9]", "", t or "")
sim = lambda a, b: SequenceMatcher(None, a, b).ratio() if a and b else 0.0

def loopy(t):  # same 2-8 char unit repeated 4+ times in a row
    return bool(re.search(r"(.{2,8}?)\1{3,}", norm(t)))

def text(g, inp="vocals"):
    s = g["stt"]
    return {m: ("" if str(s.get(m, {}).get(inp, "")).startswith("ERROR") else s[m][inp]) for m in ("whisper-large-v3", "qwen3-asr-1.7b")}

summary = []
for p in sorted(OUT.glob("*.json")):
    if p.name.endswith(("segments.json", "timing.json")): continue
    d = json.loads(p.read_text()); secs = d["sections"]
    rows = []
    for i, g in enumerate(secs):
        t = text(g); w, q = norm(t["whisper-large-v3"]), norm(t["qwen3-asr-1.7b"])
        rows.append({"i": i, "label": g["label"], "dur": g["end"] - g["start"], "agree": sim(w, q),
                     "hallu": any(h in t["whisper-large-v3"] + t["qwen3-asr-1.7b"] for h in HALLU),
                     "loop": loopy(t["whisper-large-v3"]) or loopy(t["qwen3-asr-1.7b"]), "len": max(len(w), len(q)), "key": w if len(w) >= len(q) else q})
    # lyric-repeat groups (union-find on similarity of the longer transcript)
    par = list(range(len(rows)))
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a in rows:
        for b in rows:
            if a["i"] < b["i"] and a["len"] >= 8 and b["len"] >= 8 and a["agree"] >= .5 and b["agree"] >= .5 and sim(a["key"], b["key"]) >= .6:
                par[f(a["i"])] = f(b["i"])
    groups = {}
    for r in rows: groups.setdefault(f(r["i"]), []).append(r)
    rep = [g for g in groups.values() if len(g) > 1]
    mixed = [g for g in rep if len({r["label"] for r in g}) > 1]
    reliable = [r for r in rows if r["agree"] >= .5 and not r["hallu"] and not r["loop"] and r["len"] >= 8]
    adj_same = sum(1 for a, b in zip(secs, secs[1:]) if a["label"] == b["label"])
    summary.append((d["id"], len(rows), len(reliable), sum(r["hallu"] for r in rows), sum(r["loop"] for r in rows), len(rep), len(mixed), adj_same))
    if "-v" in sys.argv:
        print(f"\n== {d['id']}")
        for r in rows:
            print(f"  {r['i']:02d} {r['label']:<10} {r['dur']:5.1f}s agree={r['agree']:.2f}{' HALLU' if r['hallu'] else ''}{' LOOP' if r['loop'] else ''}  grp={f(r['i']):02d}")
        for g in rep:
            print("   repeat-group:", [(r["i"], r["label"]) for r in g])

print(f"{'song':<26}{'secs':>5}{'reliable':>9}{'hallu':>6}{'loop':>5}{'rep-grp':>8}{'mixed-lbl':>10}{'adj-same':>9}")
for s in summary: print(f"{s[0]:<26}{s[1]:>5}{s[2]:>9}{s[3]:>6}{s[4]:>5}{s[5]:>8}{s[6]:>10}{s[7]:>9}")
tot = [sum(x[k] for x in summary) for k in range(1, 8)]
print(f"{'TOTAL':<26}{tot[0]:>5}{tot[1]:>9}{tot[2]:>6}{tot[3]:>5}{tot[4]:>8}{tot[5]:>10}{tot[6]:>9}")
