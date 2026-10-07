# Fill report_template.html with the Kaggle result files (numbers + public-domain example images).
# No computation happens here: every score was produced on Kaggle; this only embeds them.
import base64, json, statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "results"
v3 = json.loads((R / "audiveris-v3/out/scores_v3.json").read_text())
methods = {
    "qwen": {"scores": json.loads((R / "vlm/out/scores_Qwen3-VL-4B-Instruct_A.json").read_text())["scores"]},
    "base": {"scores": json.loads((R / "audiveris/out/scores_audiveris_A.json").read_text())},
    "keep": {"scores": v3["v2_keeppart"]["scores"]},
    "up3": {"scores": v3["lowres_up3_keeppart"]["scores"]},
    "up2sharp": {"scores": v3["lowres_up2sharp_keeppart"]["scores"]},
    "up2bin": {"scores": v3["lowres_up2bin_keeppart"]["scores"]},
}
summary = json.loads((R / "summary/out/summary.json").read_text())
setA = [{**a, "title": a["src"].split("/")[1].replace("_", " ")} for a in summary["setA"]]

t_v2 = json.loads((R / "audiveris/out/audiveris/timing.json").read_text())
t_v3 = json.loads((R / "audiveris-v3/out/timing_v3.json").read_text())
timing = {"clean": round(st.median(v[0] for k, v in t_v2.items() if "_clean" in k)),
          "lowres": round(st.median(v for k, v in t_v3.items() if k.startswith("up3/")))}

aud = summary["candidates"]["audiveris"]
rhythm = {"A": aud["rhythm_A"], "B": aud["rhythm_B"]["total"]}

def data_uri(p):
    mime = "image/jpeg" if p.suffix == ".jpg" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()

examples = []
man = R / "render/out/manifest.json"
if man.exists():
    titles = {a["id"]: a["title"] for a in setA}
    for e in json.loads(man.read_text()):
        d = R / "render/out"
        imgs = [d / f"{e['id']}_input.jpg", d / f"{e['id']}_gt.png", d / f"{e['id']}_pred.png"]
        if not all(p.exists() for p in imgs): continue
        examples.append({**e, "title": titles[e["id"]],
                         "score": methods["up3"]["scores"][f"{e['id']}_lowres"]["notes"]["omr_ned"],
                         "input": data_uri(imgs[0]), "gt": data_uri(imgs[1]), "pred": data_uri(imgs[2])})

wj = R / "worship/out/worship.json"
worship = json.loads(wj.read_text()) if wj.exists() else {}
wr = R / "worship-render/out"
compare = [{**m, "orig": data_uri(wr / f"{m['stem']}_orig.jpg"), "xml": data_uri(wr / f"{m['stem']}_xml.jpg")}
           for m in (json.loads((wr / "manifest.json").read_text()) if (wr / "manifest.json").exists() else [])]
rg = R / "regions/out"
regions = []
if (rg / "regions.json").exists():
    for stem, r in json.loads((rg / "regions.json").read_text()).items():
        regions.append({"stem": stem, "systems": r["systems"], "counts": r["counts"], "seconds": r["seconds"],
                        "ext": [[s["stem_ext_up"], s["stem_ext_down"]] for s in r["staff"]],
                        "img": data_uri(rg / f"{stem}_boxes.jpg")})
data = {"worship": worship, "compare": compare, "regions": regions, "methods": methods, "setA": setA, "timing": timing, "rhythm": rhythm, "examples": examples,
        "rhythm_files_B": rhythm["B"].get("files")}
html = (ROOT / "scripts/report_template.html").read_text().replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False))
(R / "report.html").write_text(html)
print("wrote results/report.html", len(html) // 1024, "KB, examples:", len(examples))
