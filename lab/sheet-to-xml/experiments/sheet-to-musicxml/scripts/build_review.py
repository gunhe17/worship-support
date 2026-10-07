# Build results/review.html from the agents' review JSONs (scratchpad/review/*.json). Flagged PNGs are copied server-side
# from the rows artifact, so this writes results/review_files.json as {published_path: {artifact, path}}. No computation.
import glob, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REV = Path(sys.argv[1]); ROWS_URL = sys.argv[2]
SUMMARY = Path(sys.argv[3]).read_text() if len(sys.argv) > 3 else ""
NAME = {"anointing": "어노인팅", "fia": "피아워십", "isaiah61": "아이자야씩스티원", "jus": "제이어스", "levites": "레위지파",
        "markers": "마커스워십", "teamluke": "팀룩워십", "welove": "위러브", "ywam": "예수전도단"}
MULTI = {"anointing", "isaiah61", "levites", "welove"}
label = lambda st: NAME.get(st.split("_")[0], st) + (f" {st.rsplit('_', 1)[1]}" if st.split("_")[0] in MULTI else "")
have = set(json.loads((ROOT / "results/rows_files.json").read_text()))
sheets, issues, files = {}, [], {}
for f in sorted(glob.glob(str(REV / "*.json"))):
    d = json.load(open(f))
    for st, s in d.get("sheets", {}).items(): sheets[st] = {**s, "label": label(st)}
    for x in d.get("issues", []):
        p = f"png/{x['stem']}/{x['file'].split('/')[-1]}"
        if p in have: x["src"] = p; files[p] = {"artifact": ROWS_URL, "path": p}
        issues.append(x)
sheets = dict(sorted(sheets.items()))
html = (ROOT / "scripts/review_template.html").read_text().replace("/*__DATA__*/null", json.dumps({"sheets": sheets, "issues": issues, "real_summary": SUMMARY}, ensure_ascii=False))
(ROOT / "results/review.html").write_text(html)
json.dump(files, open(ROOT / "results/review_files.json", "w"), ensure_ascii=False)
print("wrote results/review.html", len(html) // 1024, "KB,", len(sheets), "sheets,", len(issues), "issues,", len(files), "images")
