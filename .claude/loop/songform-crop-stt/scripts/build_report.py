# Build results/report.html from Kaggle outputs (model outputs only, no review).
import json, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from eval_cer import crop_cers, ref_text  # CER numbers only; reference lyrics stay local (refs/ is gitignored)
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "results/kaggle-v1/out")
songs = json.loads((ROOT / "songs.json").read_text())
data = []
for s in songs:
    p = OUT / f"{s['id']}.json"
    if p.exists():
        j = json.loads(p.read_text())
        g6 = ROOT / "results/kaggle-ghost613/out" / f"{s['id']}.ghost613.json"  # rerun overrides the failed v1 ghost613 outputs
        if g6.exists():
            for i, v in json.loads(g6.read_text()).items():
                j["sections"][int(i)]["stt"]["whisper-turbo-ko-ghost613"] = v
        rp = ROOT / "refs/lyrics" / f"{s['id']}.txt"
        cers = crop_cers(j["sections"], ref_text(rp)) if rp.exists() else [None] * len(j["sections"])
        data.append({k: j[k] for k in ("id", "team", "title", "pad")} | {"sections": [{k: g.get(k) for k in ("label", "start", "end", "crop_start", "crop_end", "stt")} | {"cer": c} for g, c in zip(j["sections"], cers)]})
blob = json.dumps(data, ensure_ascii=False).replace("\ufffd", "\\ufffd")  # keep raw U+FFFD from model output as a JS escape
cer = (ROOT / "results/cer.json").read_text() if (ROOT / "results/cer.json").exists() else "null"
html = (ROOT / "scripts/report_template.html").read_text().replace("/*__DATA__*/null", blob).replace("/*__CER__*/null", cer)
(ROOT / "results/report.html").write_text(html)
print("wrote results/report.html", len(data), "songs", len(html), "bytes")
