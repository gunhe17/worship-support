# Build results/split.html: every system's upper / staff / lower PNG shown separately.
# The PNGs (made on Kaggle, kaggle/regions step 5) are published next to the page as files under png/, not embedded:
# 291 PNGs are ~19MB, over the 16MB page limit. Prints the files list for the Artifact publish. No computation here.
import json, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# usage: build_split.py [results-subdir] [out-name] [note]   (default: v6 split -> results/split.html)
SRC = sys.argv[1] if len(sys.argv) > 1 else "regions-split"
OUTN = sys.argv[2] if len(sys.argv) > 2 else "split"
NOTE = sys.argv[3] if len(sys.argv) > 3 else ""
S = ROOT / "results" / SRC / "out/split"
NAME = {"anointing": "어노인팅", "fia": "피아워십", "isaiah61": "아이자야씩스티원", "jus": "제이어스", "levites": "레위지파",
        "markers": "마커스워십", "teamluke": "팀룩워십", "welove": "위러브", "ywam": "예수전도단"}
MULTI = {"anointing", "isaiah61", "levites", "welove"}
rows, files = [], []
for d in sorted(p for p in S.iterdir() if p.is_dir()):
    team, page = d.name.split("_")[0], d.name.rsplit("_", 1)[1]
    sy = defaultdict(dict)
    for f in sorted(d.glob("s*_*.png")):
        n, kind = f.stem.split("_"); rel = f"png/{d.name}/{f.name}"
        sy[int(n[1:])][kind] = rel; files.append(rel)
    rows.append({"stem": d.name, "label": NAME.get(team, team) + (f" {page}" if team in MULTI else ""),
                 "systems": [{"n": n, "parts": p} for n, p in sorted(sy.items())]})
html = (ROOT / "scripts/split_template.html").read_text().replace("/*__DATA__*/null", json.dumps(rows, ensure_ascii=False)).replace("<!--NOTE-->", NOTE)
(ROOT / f"results/{OUTN}.html").write_text(html)
# publish root = results/regions-split/out/split ; published path png/<sheet>/<file> <- <sheet>/<file>
json.dump({f: f[4:] for f in files}, open(ROOT / f"results/{OUTN}_files.json", "w"), ensure_ascii=False)
print(f"wrote results/{OUTN}.html", len(html) // 1024, "KB,", len(rows), "sheets,", len(files), "png")
