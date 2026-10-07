# Can the lyrics alone tell which part of the song a crop is?
# For each crop: align its STT text against EACH tagged section of the reference lyrics
# (semi-global, free start/end) and take the lowest-CER section as the predicted part.
# No LLM involved - this is pure text matching against the sheet's section tags.
import json, re, sys
from pathlib import Path
from statistics import median

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_cer import semiglobal, norm

ROOT = Path(__file__).resolve().parent.parent
MODEL, INPUT, THRESH = "whisper-large-v3", "mix", 0.5
base = lambda n: re.sub(r"\s*\d+$", "", n).strip().lower()

def ref_sections(p):
    secs, cur = [], None
    for l in p.read_text().splitlines():
        s = l.strip()
        if not s or s.startswith("#"): continue
        if s.startswith("["): secs.append([s.strip("[]"), ""]); cur = secs[-1]
        elif cur: cur[1] += s
    return [(n, norm(t)) for n, t in secs if norm(t)]

def predict(hyp, secs):
    """-> (part, cer, margin to next-best part) or (None, best_cer, 0) when nothing matches."""
    h = norm(hyp)
    if len(h) < 4: return None, 1.0, 0.0
    # match against the section text doubled: a crop often repeats one section twice
    # ("...얻으리 하나님께서 세상을 사랑하사..."), which a single copy cannot absorb.
    scored = sorted((lambda a: (a[0] / a[1], n))(semiglobal(h, t + t)) for n, t in secs)
    (c0, n0) = scored[0]
    other = next((c for c, n in scored[1:] if base(n) != base(n0)), 1.0)
    return (n0 if c0 < THRESH else None), c0, other - c0

rows, agree, comparable, assigned, total = [], 0, 0, 0, 0
for rp in sorted((ROOT / "refs/lyrics").glob("*.txt")):
    sid = rp.stem; secs = ref_sections(rp)
    song = json.loads((ROOT / f"results/kaggle-v1/out/{sid}.json").read_text())
    seq = []
    for g in song["sections"]:
        part, cer, margin = predict(g["stt"][MODEL][INPUT], secs)
        total += 1; assigned += part is not None
        sf = g["label"]
        if part and sf in ("verse", "pre-chorus", "chorus", "bridge"):
            comparable += 1; agree += base(part) == sf
        seq.append((g["start"], sf, part, cer, margin))
    rows.append((sid, len(secs), seq))

print(f"model={MODEL}/{INPUT}  threshold CER<{THRESH}")
print(f"crops: {total}, part assigned: {assigned} ({100*assigned/total:.0f}%)")
print(f"SongFormer label comparable: {comparable}, agree: {agree} ({100*agree/comparable:.0f}%)\n")
for sid, n, seq in rows:
    ok = sum(1 for _, sf, p, _, _ in seq if p and sf in ("verse", "pre-chorus", "chorus", "bridge") and base(p) == sf)
    cmp_ = sum(1 for _, sf, p, _, _ in seq if p and sf in ("verse", "pre-chorus", "chorus", "bridge"))
    print(f"== {sid}  (ref parts: {n})  라벨 일치 {ok}/{cmp_}")
    for t, sf, p, c, mg in seq:
        mark = "" if not p or base(p) == sf else "  <- 불일치"
        print(f"   {int(t//60)}:{int(t%60):02d}  SF={sf:<11} 가사={str(p or '-'):<11} CER={c:.2f} margin={mg:+.2f}{mark}")
