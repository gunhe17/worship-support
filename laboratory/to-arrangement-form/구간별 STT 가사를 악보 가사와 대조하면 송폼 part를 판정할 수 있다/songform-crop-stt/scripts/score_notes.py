# Grade full-score (note-level) MusicXML conversion WITHOUT reproducing any melody:
# (1) duration self-consistency: does each measure's note/rest duration sum match the
#     stated time signature? (internal check on Audiveris's own output, no ground truth needed)
# (2) cross-layout agreement: when the same song has two independently-scanned sheet
#     layouts, how much do their two independent OMR note transcriptions agree? Encodes
#     each (pitch,duration) as one character and reuses the CER edit-distance function -
#     only an aggregate similarity number is ever printed, never the note sequence itself.
import re, sys, zipfile
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, "scripts")
from eval_cer import semiglobal

ROOT = Path(__file__).resolve().parent
OMR = ROOT / "results/omr/omr"

def load(f):
    z = zipfile.ZipFile(f)
    n = [x for x in z.namelist() if x.endswith(".xml") and "container" not in x][0]
    return z.read(n).decode("utf-8", "ignore")

def measures(x):
    parts = re.split(r'(<measure number="\d+"[^>]*>)', x)[1:]
    return [(re.search(r'number="(\d+)"', h).group(1), h + b) for h, b in zip(parts[::2], parts[1::2])]

def divisions_and_time(x):
    d = re.search(r"<divisions>(\d+)</divisions>", x)
    b = re.search(r"<beats>(\d+)</beats>\s*<beat-type>(\d+)</beat-type>", x, re.S)
    return int(d.group(1)) if d else 1, (int(b.group(1)), int(b.group(2))) if b else (4, 4)

def measure_cursor_end(mtext):
    """Final cursor position after replaying notes/backup/forward in document order."""
    cur = 0
    for tag, dur in re.findall(r"<(note|backup|forward)\b[^>]*>(.*?)</\1>", mtext, re.S):
        d = re.search(r"<duration>(\d+)</duration>", dur)
        if not d: continue
        v = int(d.group(1))
        if tag == "backup": cur -= v
        elif tag == "forward": cur += v
        elif "<chord" not in dur: cur += v
    return cur

def note_tokens(mtext):
    """One token per non-chord note/rest: pitch+alter+octave+duration, or 'R'+duration."""
    toks = []
    for nt in re.findall(r"<note\b[^>]*>.*?</note>", mtext, re.S):
        if "<chord" in nt: continue
        dur = re.search(r"<duration>(\d+)</duration>", nt)
        dur = dur.group(1) if dur else "?"
        if "<rest" in nt:
            toks.append(f"R{dur}")
        else:
            step = re.search(r"<step>(.)</step>", nt); alt = re.search(r"<alter>(-?\d+)</alter>", nt)
            oct_ = re.search(r"<octave>(\d+)</octave>", nt)
            toks.append(f"{step.group(1) if step else '?'}{alt.group(1) if alt else '0'}{oct_.group(1) if oct_ else '?'}_{dur}")
    return toks

# ---- (1) duration self-consistency, all files
print("## 박자 정합성 (Audiveris 출력 자체의 내적 일관성)\n")
print(f"{'file':<34}{'measures':>9}{'ok':>5}{'partial(pickup 등)':>20}{'mismatch':>9}")
totals = [0, 0, 0]
for f in sorted(OMR.glob("*.mxl")):
    x = load(f)
    div, (beats, btype) = divisions_and_time(x)
    ms = measures(x)
    if not ms: continue
    expect = beats * div * 4 // btype
    ok = partial = bad = 0
    for i, (num, mt) in enumerate(ms):
        end = measure_cursor_end(mt)
        if end == expect: ok += 1
        elif (i == 0 or i == len(ms) - 1) and 0 < end < expect: partial += 1  # pickup/incomplete last bar: normal
        else: bad += 1
    totals[0] += ok; totals[1] += partial; totals[2] += bad
    print(f"{f.name[:33]:<34}{len(ms):>9}{ok:>5}{partial:>20}{bad:>9}")
n = sum(totals)
print(f"{'TOTAL':<34}{n:>9}{totals[0]:>5}{totals[1]:>20}{totals[2]:>9}   ({100*totals[0]/n:.0f}% 정확, {100*totals[2]/n:.0f}% 불일치)")

# ---- (2) cross-layout agreement for songs with >1 independently-scanned layout of the same chart
print("\n## 같은 곡·다른 레이아웃 간 음표 일치율 (사람이 만든 정답 없이 상호 검증)\n")
pairs = [("anointing_rejoice_1", "anointing_rejoice_2")]
for a, b in pairs:
    fa, fb = OMR / f"in_{a}.mxl", OMR / f"in_{b}.mxl"
    if not (fa.exists() and fb.exists()): continue
    ta = [t for _, m in measures(load(fa)) for t in note_tokens(m)]
    tb = [t for _, m in measures(load(fb)) for t in note_tokens(m)]
    vocab = {t: chr(0x3000 + i) for i, t in enumerate(dict.fromkeys(ta + tb))}
    sa, sb = "".join(vocab[t] for t in ta), "".join(vocab[t] for t in tb)
    dist, span = semiglobal(sa, sb) if len(sa) <= len(sb) else semiglobal(sb, sa)
    agree = 1 - dist / max(span, 1)
    print(f"{a} ({len(ta)} notes) vs {b} ({len(tb)} notes): 편집거리 기준 일치율 {agree:.1%}")
