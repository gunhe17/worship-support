# Score sheet-reading output (Kaggle VLM kernel) against the hand-read reference lyrics.
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_cer import semiglobal, norm

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "results/sheet-vlm-kaggle/vlm"
SKIP = {"teamluke_built-together"}  # sheet carries English lyrics only

def parse(p):
    t = p.read_text()
    m = re.search(r"\{.*\}", t, re.S)
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception: return None

for mdir in sorted(d for d in BASE.iterdir() if d.is_dir()):
    songs, bad = {}, 0
    for f in sorted(mdir.glob("*.json")):
        if f.name.startswith("_"): continue
        sid = re.sub(r"_\d+$", "", f.stem)
        if sid in SKIP: continue
        d = parse(f)
        bad += d is None
        secs = (d or {}).get("sections", [])
        s = songs.setdefault(sid, {"lyrics": "", "tags": []})
        s["lyrics"] += " " + " ".join(str(x.get("lyrics", "")) for x in secs if isinstance(x, dict))
        s["tags"] += [str(x.get("tag", "")) for x in secs if isinstance(x, dict)]
    timing = json.loads((mdir / "_timing.json").read_text()) if (mdir / "_timing.json").exists() else {}
    print(f"\n### {mdir.name}   JSON 파싱 실패 {bad}장, 장당 평균 {sum(timing.values())/max(1,len(timing)):.0f}초")
    print(f"{'song':<26}{'CER':>8}  tags")
    cers = []
    for sid, v in sorted(songs.items()):
        ref = (ROOT / "refs/lyrics" / f"{sid}.txt").read_text()
        r = norm("".join(l for l in ref.splitlines() if not l.strip().startswith(("#", "["))))
        a = semiglobal(norm(v["lyrics"]), r)
        cer = min(a[0] / a[1], 3.0) if a else 1.0
        cers.append(cer)
        print(f"{sid:<26}{cer:>8.3f}  {', '.join(dict.fromkeys(t for t in v['tags'] if t))[:60]}")
    print(f"{'MEAN':<26}{sum(cers)/len(cers):>8.3f}")
