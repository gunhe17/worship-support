# Kaggle T4 probe: can oemer's pretrained segmentation (staff lines / noteheads) tell staff regions apart? (LOG 46)
# Runs only oemer's two U-Nets (no oemer pipeline after that) on a sample of sheets, maps the masks onto the staff-500
# working image (A4 width 2480), and measures, per labelled band:
#   staff      = staves found by staff detection v1 (main spacing)      -> should have noteheads + 5 lines
#   head-real  = staves added by the multi-head (n_strips >= P6x)       -> same
#   head-fake  = multi-head finds on glyph strokes (n_strips < P6x, LOG 41-42) -> should have neither
#   missed     = the staves v1 missed (LOG 44-45)                       -> should have both
#   lyric / symbol rows from regions-500 (not flagged)                  -> should have no noteheads
import glob, json, os, subprocess, sys, time
# v1: Kaggle's onnxruntime (py3.13) rejects oemer's ONNX ("pads must not contain negative values") ->
# run this script again inside a python 3.11 venv with onnxruntime 1.16 on CPU
VENV = "/tmp/venv"
if sys.prefix != VENV:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "uv"], check=True)
    subprocess.run(["uv", "venv", "-q", "-p", "3.11", VENV], check=True)
    subprocess.run(["uv", "pip", "install", "-q", "-p", f"{VENV}/bin/python", "oemer==0.1.8", "--no-deps"], check=True)
    subprocess.run(["uv", "pip", "install", "-q", "-p", f"{VENV}/bin/python", "onnxruntime==1.16.3", "numpy<2",
                    "opencv-python-headless", "pillow", "scipy", "scikit-learn", "matplotlib", "typing-extensions"], check=True)
    sys.exit(subprocess.run([f"{VENV}/bin/python", os.path.abspath(__file__)]).returncode)
import cv2, numpy as np
from PIL import Image
import oemer, oemer.ete
from oemer.inference import inference

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/vis", exist_ok=True); TMP = "/tmp/flat"; os.makedirs(TMP, exist_ok=True)
W8 = 2480
MISSED = {"jrabbit_sarangeun-love-is_1": [(1628, 1714), (1973, 2059)], "jus_nae-moseup-idaero_1": [(1751, 1813)],
          "susanghanstreet_o-juyeo_1": [(824, 887)]}
EXTRA = ["goodseed_only-lord_1", "billyfunk_give-thanks-and-praise_1", "isaiah61_in-the-fog_1", "welove_loving-you-more_1",
         "j-us_abeojiui-sarang_2", "jus_sipjaga_1", "withgod_ju-malsseum-yeongwonhari_1", "teamluke_goodness-of-god_1",
         "maggidawn_geuneun-uri-joereul_1", "choiyongduk_naui-himi-doesin_1", "markers_glorious-splendor_1"]

# checkpoints: same download oemer's CLI does on first run
mp = os.path.dirname(oemer.__file__)
if not os.path.exists(os.path.join(mp, "checkpoints/unet_big/model.onnx")):
    for title, url in oemer.ete.CHECKPOINTS_URL.items():
        d = os.path.join(mp, "checkpoints", "unet_big" if title.startswith("1st") else "seg_net")
        oemer.ete.download_file(title, url, os.path.join(d, title.split("_")[1]))

found = glob.glob("/kaggle/input/**/staff.json", recursive=True) + glob.glob("/kaggle/input/**/regions.json", recursive=True)
print(found, flush=True)
staff = json.load(open(next(p for p in found if p.endswith("staff.json") and "p6x" not in p)))["sheets"]
p6x = json.load(open(next(p for p in found if p.endswith("staff.json") and "p6x" in p)))["sheets"]
regions = json.load(open(next(p for p in found if p.endswith("regions.json"))))
paths = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True)
         if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}

def bands(stem, r, reg, p):
    out = []
    for s in r["staves"]:
        y0 = min(v[1][0] for v in s["strips"]); y1 = max(v[1][4] for v in s["strips"])
        kind = "staff" if s["head_p"] == r["p"] else ("head-real" if s["n_strips"] >= 6 else "head-fake")
        out.append(dict(kind=kind, y=[y0, y1], x=s["x"], gap=s["head_p"]))
    for h in r.get("heads", []):                       # fakes that P6x removed (found_list kept by staff-500)
        for f in h.get("found_list", []):
            if f["n_strips"] < 6:
                out.append(dict(kind="head-fake", y=[f["top"], f["top"] + 4 * h["p"]], x=f["x"], gap=h["p"]))
    for y0, y1 in MISSED.get(stem, []):
        out.append(dict(kind="missed", y=[y0, y1], x=[150, 2300], gap=p))
    if reg:
        flagged = {q["file"] for q in reg["problems"]}; split = reg["split"]
        for row in reg["rows"]:
            if row["file"] in flagged or row["h_gaps"] < 0.6: continue
            xs = split[min(row["band"], len(split) - 1)]["x"]
            out.append(dict(kind="lyric" if row["lyric_boxes"] else "symbol", y=[round(v * 1.24) for v in row["y"]],
                            x=[round(v * 1.24) for v in xs], gap=p, file=row["file"]))
    return out

def measure(b, line_m, head_m, p):
    y0, y1 = b["y"]; x0, x1 = b["x"]
    if b["kind"] in ("staff", "head-real", "head-fake", "missed"):     # staff body + room for notes above/below
        y0, y1 = y0 - b["gap"], y1 + b["gap"]
    y0, y1 = max(0, int(y0)), min(line_m.shape[0], int(y1)); x0, x1 = max(0, int(x0)), min(line_m.shape[1], int(x1))
    if y1 <= y0 or x1 <= x0: return None
    lm = line_m[y0:y1, x0:x1]; hm = head_m[y0:y1, x0:x1].astype(np.uint8)
    # staff lines: rows whose line-mask covers >= 30% of the band width (+-1 row merged)
    cov = cv2.dilate(lm.astype(np.uint8), np.ones((3, 1), np.uint8)).mean(axis=1)
    rows = np.flatnonzero(cov >= 0.3); lines = int((np.diff(np.r_[-2, rows]) > 1).sum()) if len(rows) else 0
    # noteheads: mask components at least a quarter of a head (0.5p x 0.5p)
    n, _, st, _ = cv2.connectedComponentsWithStats(hm, connectivity=8)
    heads = int(sum(1 for i in range(1, n) if st[i, 4] >= 0.25 * b["gap"] ** 2))
    return dict(lines=lines, heads=heads, head_px=int(hm.sum()), line_cov_max=round(float(cov.max()), 3))

res = {}; sample = sorted(set(MISSED) | set(EXTRA) | {k for k, v in staff.items() if any(s["head_p"] != v.get("p") for s in v.get("staves", []))})
for stem in sample:
    t0 = time.time(); r = p6x.get(stem) or staff[stem]
    pim = Image.open(paths[stem]).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    flat = f"{TMP}/{stem}.png"; bg.convert("RGB").save(flat)          # transparent PNGs read black otherwise (LOG 17)
    w0, h0 = pim.size; f = W8 / w0; size = (W8, round(h0 * f))
    m1, _ = inference(os.path.join(mp, "checkpoints/unet_big"), flat)
    m2, _ = inference(os.path.join(mp, "checkpoints/seg_net"), flat, manual_th=None)
    line_m = cv2.resize((m1 == 1).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST).astype(bool)
    head_m = cv2.resize((m2 == 2).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST).astype(bool)
    stem_m = cv2.resize((m2 == 1).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST).astype(bool)
    bs = bands(stem, r, regions.get(stem), r["p"])
    for b in bs: b.update(measure(b, line_m, head_m, r["p"]) or {})
    res[stem] = dict(p=r["p"], seconds=round(time.time() - t0, 1), oemer_size=list(m1.shape[::-1]), bands=bs)
    # picture: staff lines blue, noteheads red, stems/rests orange, bands outlined by kind
    im = cv2.resize(cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR), size, interpolation=cv2.INTER_CUBIC)
    vis = (im * 0.55 + 255 * 0.45).astype(np.uint8)
    vis[line_m] = (230, 120, 0); vis[stem_m] = (0, 150, 255); vis[head_m] = (0, 0, 230)
    col = {"staff": (0, 160, 0), "head-real": (0, 160, 0), "head-fake": (200, 0, 200), "missed": (0, 200, 255)}
    for b in bs:
        if b["kind"] in col:
            cv2.rectangle(vis, (int(b["x"][0]), int(b["y"][0] - b["gap"])), (int(b["x"][1]), int(b["y"][1] + b["gap"])), col[b["kind"]], 3)
    vis = cv2.resize(vis, (1200, round(vis.shape[0] * 1200 / vis.shape[1])), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f"{OUT}/vis/{stem}.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(stem, "s", res[stem]["seconds"], {k: [(b.get("lines"), b.get("heads")) for b in bs if b["kind"] == k][:6]
          for k in ("staff", "head-real", "head-fake", "missed")}, flush=True)
json.dump(res, open(f"{OUT}/oemer.json", "w"), indent=1)

# summary per kind
summary = {}
for k in ("staff", "head-real", "head-fake", "missed", "lyric", "symbol"):
    bb = [b for v in res.values() for b in v["bands"] if b["kind"] == k and "heads" in b]
    if not bb: continue
    summary[k] = dict(n=len(bb), with_heads=sum(b["heads"] >= 3 for b in bb), any_head=sum(b["heads"] >= 1 for b in bb),
                      five_lines=sum(b["lines"] >= 5 for b in bb), lines_median=float(np.median([b["lines"] for b in bb])))
print(json.dumps(summary, indent=1)); json.dump(summary, open(f"{OUT}/summary.json", "w"), indent=1)
