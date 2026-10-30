# Kaggle T4: can a notation-only segmentation model (oemer U-Nets, trained on CvcMuscima / DeepScores, no text classes)
# separate music notation from text in the sets pipeline (LOG 58)? For every GT word box (sets-gt.json, LOG 55): share of
# its ink covered by oemer's notation masks (model 2: stems/rests, noteheads, clefs/keys/accidentals; model 1: symbols).
# Reports per-label medians and the best single-threshold N-vs-rest accuracy, also on the boxes sets v9 got wrong.
import glob, json, os, subprocess, sys, time
ORT = "1.19.2"                                  # LOG 47: 1.17.1-1.19.2 load the model with CUDA
VENV = "/tmp/venv"
if sys.prefix != VENV:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "uv"], check=True)
    subprocess.run(["uv", "venv", "-q", "-p", "3.11", VENV], check=True)
    subprocess.run(["uv", "pip", "install", "-q", "-p", f"{VENV}/bin/python", "oemer==0.1.8", "--no-deps"], check=True)
    cuda = ["nvidia-cudnn-cu12==9.*", "nvidia-cublas-cu12", "nvidia-cufft-cu12", "nvidia-curand-cu12", "nvidia-cuda-runtime-cu12", "nvidia-cuda-nvrtc-cu12"]
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

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
W8 = 2480; BATCH = 8; STEP = 128                # BATCH 32 ran out of T4 memory (LOG 47)

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
    return s, meta
SESS = {n: session(n) for n in ("unet_big", "seg_net")}


def segment(image, name):
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


GT = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets-gt.json", recursive=True)))))
STAFF = json.load(open(next(iter(glob.glob("/kaggle/input/**/staff.json", recursive=True)))))["sheets"]
SETS = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets.json", recursive=True)))))["sheets"]
paths = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}

rows = []; t_all = time.time()
for n_, stem in enumerate(sorted(GT), 1):
    pim = Image.open(paths[stem]).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    rgb = bg.convert("RGB"); w0, h0 = rgb.size
    img = np.array(resize_image(Image.fromarray(np.array(rgb)[:, :, ::-1])))       # oemer reads BGR
    m1 = segment(img, "unet_big"); m2 = segment(img, "seg_net")
    f = W8 / w0; size = (W8, round(h0 * f)); k3 = np.ones((3, 3), np.uint8)
    mask = {name: cv2.dilate(cv2.resize((m == c).astype(np.uint8), size, interpolation=cv2.INTER_NEAREST), k3)
            for name, m, c in (("sym", m1, 2), ("stems", m2, 1), ("head", m2, 2), ("clef", m2, 3))}
    note = (mask["stems"] | mask["head"] | mask["clef"])
    im = cv2.resize(np.array(rgb)[:, :, ::-1], size, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
    ink = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) < STAFF[stem]["ink_T"]
    bad = {tuple(q["box"]) for q in SETS[stem]["score"]["fails"] if q["kind"] == "w"}
    for kind, x0, y0, x1, y1, want in GT[stem]:
        if kind != "w": continue
        sub = ink[y0:y1, x0:x1]; nk = int(sub.sum())
        if not nk: continue
        fr = {name: round(float((m[y0:y1, x0:x1][sub]).mean()), 3) for name, m in (*mask.items(), ("note", note))}
        rows.append(dict(stem=stem, box=[x0, y0, x1, y1], want=want, wrong=(x0, y0, x1, y1) in bad, ink=nk, **fr))
    print(f"progress {n_}/{len(GT)} {time.time() - t_all:.0f}s", flush=True)
json.dump(rows, open(f"{OUT}/frac.json", "w"), separators=(",", ":"))

# summarize
for name in ("note", "sym", "head", "stems", "clef"):
    med = {w: round(float(np.median([r[name] for r in rows if r["want"] == w])), 3) for w in "CLNX"}
    best = max(((t, np.mean([(r[name] >= t) == (r["want"] == "N") for r in rows])) for t in np.arange(0.05, 1.0, 0.05)), key=lambda q: q[1])
    t = best[0]; cm = {}
    for r in rows: cm[f"{r['want']}{'+' if r[name] >= t else '-'}"] = cm.get(f"{r['want']}{'+' if r[name] >= t else '-'}", 0) + 1
    wr = [r for r in rows if r["wrong"]]
    wrong_ok = sum((r[name] >= t) == (r["want"] == "N") for r in wr)
    print("selftest", name, "median", med, "best t", round(t, 2), "acc", round(best[1], 3), "split", cm, "on v9-wrong", wrong_ok, "/", len(wr), flush=True)
