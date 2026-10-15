# Build results/rows.html: staff PNGs + ink rows between staves (kaggle/regions step 6). Images are published as files
# under png/ (too big to embed); writes results/rows_files.json for the publish. No computation here.
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "results" / (sys.argv[1] if len(sys.argv) > 1 else "regions-rows") / "out"
NAME = {"anointing": "어노인팅", "fia": "피아워십", "isaiah61": "아이자야씩스티원", "jus": "제이어스", "levites": "레위지파",
        "markers": "마커스워십", "teamluke": "팀룩워십", "welove": "위러브", "ywam": "예수전도단"}
MULTI = {"anointing", "isaiah61", "levites", "welove"}
reg = json.loads((SRC / "regions.json").read_text())
data, files = [], {}
for stem, r in reg.items():
    team, page = stem.split("_")[0], stem.rsplit("_", 1)[1]
    staff = [f"png/{stem}/s{i + 1:02d}_staff.png" for i in range(len(r["staff"]))]
    rows = [{**x, "src": f"png/{stem}/{x['file']}"} for x in r.get("rows", [])]
    for p in staff + [x["src"] for x in rows]: files[p] = p[4:]
    data.append({"stem": stem, "label": NAME.get(team, team) + (f" {page}" if team in MULTI else ""), "staff": staff, "rows": rows})
html = (ROOT / "scripts/rows_template.html").read_text().replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False))
(ROOT / "results/rows.html").write_text(html)
json.dump(files, open(ROOT / "results/rows_files.json", "w"), ensure_ascii=False)
print("wrote results/rows.html", len(html) // 1024, "KB,", len(data), "sheets,", len(files), "images")
