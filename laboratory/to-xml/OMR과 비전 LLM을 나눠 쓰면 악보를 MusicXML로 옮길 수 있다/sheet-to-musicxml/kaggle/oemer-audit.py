# Kaggle T4: audit staff detection v1 on all 500 sheets with oemer's segmentation (LOG 47).
# Per sheet: oemer staff-line and notehead masks on the full page (oemer's own scaling), mapped to the staff-500 working
# image (A4 width 2480). Saves the evidence (notehead boxes, staff-line rows) so later rules can be scored without
# rerunning oemer, and lists candidate MISSED staves = places with oemer evidence that no detected staff covers:
#   heads: >= 3 noteheads in one horizontal band outside every detected staff (+-4 gaps for ledger notes)
#   lines: a run of >= 4 oemer staff-line rows at staff spacing outside every detected staff
import glob, json, os, subprocess, sys, time
ORT = "1.19.2"                                  # sheet-oemer-gpu: 1.17.1-1.19.2 load the model with CUDA; 1.20.1 has no wheel
VENV = "/tmp/venv"
if sys.prefix != VENV:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "uv"], check=True)
    subprocess.run(["uv", "venv", "-q", "-p", "3.11", VENV], check=True)
    subprocess.run(["uv", "pip", "install", "-q", "-p", f"{VENV}/bin/python", "oemer==0.1.8", "--no-deps"], check=True)
    cuda = ["nvidia-cudnn-cu12==9.*" if ORT >= "1.18.1" else "nvidia-cudnn-cu12==8.*", "nvidia-cublas-cu12", "nvidia-cufft-cu12",
            "nvidia-curand-cu12", "nvidia-cuda-runtime-cu12", "nvidia-cuda-nvrtc-cu12"]
    subprocess.run(["uv", "pip", "install", "-q", "-p", f"{VENV}/bin/python", f"onnxruntime-gpu=={ORT}", "numpy<2",
                    "opencv-python-headless", "pillow", "scipy", "scikit-learn", "matplotlib", "typing-extensions", *cuda], check=True)
    site = subprocess.run([f"{VENV}/bin/python", "-c", "import site;print(site.getsitepackages()[0])"], capture_output=True, text=True).stdout.strip()
    env = dict(os.environ, LD_LIBRARY_PATH=":".join(glob.glob(f"{site}/nvidia/*/lib")) + ":" + os.environ.get("LD_LIBRARY_PATH", ""))
    sys.exit(subprocess.run([f"{VENV}/bin/python", os.path.abspath(__file__)], env=env).returncode)

import pickle
import cv2, numpy as np, onnxruntime as rt
from PIL import Image
import oemer, oemer.ete
from oemer.inference import resize_image

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/cand", exist_ok=True); os.makedirs(f"{OUT}/vis", exist_ok=True)
W8 = 2480; BATCH = 32; STEP = 128

mp = os.path.dirname(oemer.__file__)
for title, url in oemer.ete.CHECKPOINTS_URL.items():
    if title.endswith(".onnx"):
        d = os.path.join(mp, "checkpoints", "unet_big" if title.startswith("1st") else "seg_net")
        if not os.path.exists(os.path.join(d, "model.onnx")):
            oemer.ete.download_file(title, url, os.path.join(d, title.split("_")[1]))
def session(name):
    d = os.path.join(mp, "checkpoints", name); meta = pickle.load(open(os.path.join(d, "metadata.pkl"), "rb"))
    s = rt.InferenceSession(os.path.join(d, "model.onnx"), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    print(name, s.get_providers(), flush=True)
    # 500 pages on CPU would take ~86 h (LOG 46) -> stop instead of silently falling back
    if s.get_providers()[0] != "CUDAExecutionProvider": sys.exit(f"{name}: CUDA not used {s.get_providers()}")
    return s, meta
SESS = {n: session(n) for n in ("unet_big", "seg_net")}

def segment(image, name):
    # oemer.inference.inference without the file round trip; same patching and averaging
    sess, meta = SESS[name]; win = meta["input_shape"][1]; H, W = image.shape[:2]
    ys = sorted({min(y, H - win) for y in range(0, H, STEP)}); xs = sorted({min(x, W - win) for x in range(0, W, STEP)})
    pos = [(y, x) for y in ys for x in xs]
    acc = np.zeros((H, W, meta["output_shape"][-1]), np.float32); cnt = np.zeros((H, W, 1), np.float32)
    for i in range(0, len(pos), BATCH):
        chunk = pos[i:i + BATCH]
        pred = sess.run(meta["output_names"], {"input": np.stack([image[y:y + win, x:x + win] for y, x in chunk]).astype(np.uint8)})[0]
        for (y, x), p in zip(chunk, pred):
            acc[y:y + win, x:x + win] += p; cnt[y:y + win, x:x + win] += 1
    return np.argmax(acc / cnt, axis=-1)

found = glob.glob("/kaggle/input/**/staff.json", recursive=True)
staff = json.load(open(next(p for p in found if "p6x" not in p)))["sheets"]
p6x = json.load(open(next(p for p in found if "p6x" in p)))["sheets"]
paths = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True)
         if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}

def our_staves(r):
    # final v1 staves: the multi-head finds shorter than P6x were dropped (LOG 42)
    out = []
    for s in r.get("staves", []):
        if s["head_p"] != r["p"] and s["n_strips"] < 6: continue
        out.append(dict(y=[min(v[1][0] for v in s["strips"]), max(v[1][4] for v in s["strips"])], x=s["x"], gap=s["head_p"]))
    return out

res = {}; t_all = time.time()
for stem in sorted(staff):
    if time.time() - t_all > 11 * 3600: print("time budget reached", flush=True); break   # Kaggle stops at 12 h
    r = p6x.get(stem) or staff[stem]
    if not r.get("p"): res[stem] = dict(error="no staff spacing"); continue
    t0 = time.time()
    try:
        pim = Image.open(paths[stem]).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
        rgb = bg.convert("RGB"); w0, h0 = rgb.size
        # oemer reads with cv2 (BGR) for non-GIF files; keep the channel order it was trained with
        img = np.array(resize_image(Image.fromarray(np.array(rgb)[:, :, ::-1])))
        m1 = segment(img, "unet_big"); m2 = segment(img, "seg_net")
        f = W8 / w0; size = (W8, round(h0 * f))
        line_m = cv2.resize((m1 == 1).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST)
        head_m = cv2.resize((m2 == 2).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST)
        p = r["p"]; ours = our_staves(r)
        # evidence: notehead boxes, staff-line rows (row coverage >= 30% of the page's staff width)
        n, _, st, cen = cv2.connectedComponentsWithStats(head_m, connectivity=8)
        heads = [[int(st[i, 0]), int(st[i, 1]), int(st[i, 2]), int(st[i, 3]), int(st[i, 4])] for i in range(1, n) if st[i, 4] >= 0.25 * p * p]
        xs = [s["x"] for s in ours] or [[int(0.05 * W8), int(0.95 * W8)]]
        xa, xb = min(x[0] for x in xs), max(x[1] for x in xs)
        cov = cv2.dilate(line_m[:, xa:xb], np.ones((3, 1), np.uint8)).mean(axis=1)
        rows = np.flatnonzero(cov >= 0.3)
        line_rows = []                                   # merged runs: [y_centre, coverage]
        for grp in np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1) if len(rows) else []:
            line_rows.append([int(grp.mean()), round(float(cov[grp].max()), 3)])
        # coverage by our staves: body +- 4 gaps (notes on ledger lines sit up to ~3 gaps outside)
        def covered(y): return any(s["y"][0] - 4 * s["gap"] <= y <= s["y"][1] + 4 * s["gap"] for s in ours)
        cands = []
        loose = sorted([h for h in heads if not covered(h[1] + h[3] / 2)], key=lambda h: h[1])
        group = []
        for h in loose + [None]:
            if h is not None and (not group or h[1] + h[3] / 2 - (group[-1][1] + group[-1][3] / 2) <= 3 * p):
                group.append(h); continue
            if len(group) >= 3:
                cands.append(dict(kind="heads", y=[min(g[1] for g in group), max(g[1] + g[3] for g in group)], n=len(group)))
            group = [h] if h is not None else []
        lr = [l for l in line_rows if not covered(l[0])]
        run = []
        for l in lr + [None]:
            if l is not None and run and abs((l[0] - run[-1][0]) - p) <= 0.35 * p:
                run.append(l); continue
            if len(run) >= 4:
                cands.append(dict(kind="lines", y=[run[0][0], run[-1][0]], n=len(run)))
            run = [l] if l is not None else []
        res[stem] = dict(p=p, scale=round(f, 4), seconds=round(time.time() - t0, 1), staves=ours, heads=heads, line_rows=line_rows, cands=cands)
        if cands:
            im = cv2.resize(np.array(rgb)[:, :, ::-1], size, interpolation=cv2.INTER_CUBIC)
            vis = (im * 0.55 + 255 * 0.45).astype(np.uint8)
            vis[line_m > 0] = (230, 120, 0); vis[head_m > 0] = (0, 0, 230)
            for s in ours: cv2.rectangle(vis, (s["x"][0], s["y"][0]), (s["x"][1], s["y"][1]), (0, 160, 0), 3)
            for i, c in enumerate(cands):
                cv2.rectangle(vis, (8, int(c["y"][0] - p)), (W8 - 8, int(c["y"][1] + p)), (0, 200, 255), 4)
                crop = vis[max(0, int(c["y"][0] - 3 * p)):int(c["y"][1] + 3 * p)]
                cv2.imwrite(f"{OUT}/cand/{stem}_{i}_{c['kind']}.jpg", cv2.resize(crop, (1400, max(1, round(crop.shape[0] * 1400 / W8)))), [cv2.IMWRITE_JPEG_QUALITY, 85])
            cv2.imwrite(f"{OUT}/vis/{stem}.jpg", cv2.resize(vis, (1100, round(vis.shape[0] * 1100 / W8)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 80])
        if len(res) % 25 == 0: json.dump(res, open(f"{OUT}/audit.json", "w"), separators=(",", ":"))
        print(stem, res[stem]["seconds"], "s", "staves", len(ours), "heads", len(heads), "cands", cands, flush=True)
    except Exception as e:
        import traceback; res[stem] = dict(error=repr(e), tb=traceback.format_exc()); print(stem, "ERROR", e, flush=True)
json.dump(res, open(f"{OUT}/audit.json", "w"), separators=(",", ":"))
print("total", round(time.time() - t_all), "s", "sheets with candidates", sum(1 for v in res.values() if v.get("cands")), flush=True)
