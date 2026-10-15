# Kaggle CPU kernel: improve Audiveris without changing the engine.
#  1) post-process: Audiveris often splits one lead sheet into 2 parts (P1 melody + a spurious P2);
#     the answer key has 1 part, so the extra part is scored as insertions. Keep the part with the
#     most notes and rescore the existing v2 outputs.
#  2) preprocessing for low-res images (real worship sheets are 700-1000px blog images):
#     compare upscale x2 (v2 baseline), x3, x2+unsharp, x2+binarize, all + keep-largest-part.
# Inputs: kernel_sources gunhe17/sheet-xml-audiveris (images/A, gt/, audiveris/A).
import glob, json, os, shutil, signal, subprocess, sys, time

def sh(cmd):
    print("$", cmd[:170], flush=True); return subprocess.run(cmd, shell=True)

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
SRC = glob.glob("/kaggle/input/**/out/setA.json", recursive=True)[0].rsplit("/", 1)[0]
print("inputs:", SRC, flush=True)
sh(f"{sys.executable} -m pip install -q musicdiff pillow > {OUT}/pip.log 2>&1")
sh("apt-get -qq update > /dev/null 2>&1; apt-get -qq install -y tesseract-ocr xvfb libgtk-3-0 libfreetype6 fontconfig > /dev/null 2>&1")
import music21 as m21, musicdiff
from PIL import Image, ImageFilter, ImageOps

# ---------------- keep-largest-part post-process ----------------
def keep_largest_part(src, dst):
    s = m21.converter.parse(src)
    parts = list(s.parts)
    if len(parts) > 1:
        best = max(parts, key=lambda p: len(p.recurse().notes))
        for p in parts:
            if p is not best: s.remove(p)
    s.write("musicxml", dst)
    return len(parts)

# ---------------- scoring ----------------
DL = musicdiff.DetailLevel
DETAILS = {"notes": DL.NotesAndRests, "signatures": DL.Signatures, "barlines": DL.Barlines,
           "chords": DL.ChordSymbols, "lyrics": DL.Lyrics, "all": DL.AllObjects}
class TO(Exception): pass
signal.signal(signal.SIGALRM, lambda *a: (_ for _ in ()).throw(TO()))
def omr_ned(pred, gt, detail):
    if not os.path.exists(pred): return {"omr_ned": 1.0, "failed": "no output"}
    signal.alarm(600)
    try:
        r = musicdiff._diff_omr_ned_metrics(pred, gt, detail)
        return None if r is None else {"omr_ned": round(r.omr_ned, 4), "gt_syms": r.gt_numsyms,
                                       "pred_syms": r.pred_numsyms, "edits": r.omr_edit_distance}
    except TO: return {"omr_ned": None, "failed": "timeout"}
    except Exception as e: return {"omr_ned": None, "failed": repr(e)[:120]}
    finally: signal.alarm(0)

setA = json.load(open(f"{SRC}/setA.json"))
results = {}

def score_dir(label, mxl_dir, variants):
    """keep-largest-part on each Audiveris .mxl in mxl_dir, then score against the answer key."""
    pp = f"{OUT}/pp/{label}"; os.makedirs(pp, exist_ok=True)
    res, nparts = {}, {}
    for a in setA:
        for var in variants:
            key = f"{a['id']}_{var}"
            src = f"{mxl_dir}/{key}.mxl"
            dst = f"{pp}/{key}.musicxml"
            if os.path.exists(src):
                try: nparts[key] = keep_largest_part(src, dst)
                except Exception as e: print("  pp fail", key, repr(e)[:80])
            res[key] = {k: omr_ned(dst, f"{SRC}/gt/{a['id']}.musicxml", d) for k, d in DETAILS.items()}
        print(f"  {label}: {a['id']} done", flush=True)
    results[label] = {"scores": res, "parts_before": nparts}
    json.dump(results, open(f"{OUT}/scores_v3.json", "w"), indent=1)

# 1) existing v2 outputs, post-processed
score_dir("v2_keeppart", f"{SRC}/audiveris/A", ("clean", "lowres"))

# ---------------- 2) preprocessing variants on low-res ----------------
deb = "Audiveris-5.11.0-ubuntu22.04-x86_64.deb" if "22.04" in open("/etc/os-release").read() else "Audiveris-5.11.0-ubuntu24.04-x86_64.deb"
sh(f"wget -q https://github.com/Audiveris/audiveris/releases/download/5.11.0/{deb} -O /tmp/{deb} && apt-get install -y /tmp/{deb} > /dev/null 2>&1")
AUD = next(iter(glob.glob("/opt/**/bin/Audiveris", recursive=True)), None)
print("AUD =", AUD, flush=True)
TESS = "/tmp/tessdata"; os.makedirs(TESS, exist_ok=True)
sh(f"wget -q https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata -O {TESS}/eng.traineddata")

def prep(im, how):
    if how == "up2":       return im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    if how == "up3":       return im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    if how == "up2sharp":  return im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    if how == "up2bin":
        g = ImageOps.grayscale(im.resize((im.width * 2, im.height * 2), Image.LANCZOS))
        hist = g.histogram(); total = sum(hist); sum_all = sum(i * h for i, h in enumerate(hist))
        wB = sumB = 0; best, thr = -1, 128
        for t in range(256):                       # Otsu threshold
            wB += hist[t]
            if wB == 0 or wB == total: continue
            sumB += t * hist[t]; mB = sumB / wB; mF = (sum_all - sumB) / (total - wB)
            v = wB * (total - wB) * (mB - mF) ** 2
            if v > best: best, thr = v, t
        return g.point(lambda p: 255 if p > thr else 0).convert("RGB")
    raise ValueError(how)

timing = {}
for how in ("up3", "up2sharp", "up2bin"):
    od = f"/tmp/aud_{how}"; os.makedirs(od, exist_ok=True)
    for a in setA:
        stem = f"{a['id']}_lowres"
        inp = f"/tmp/in_{how}/{stem}.png"; os.makedirs(os.path.dirname(inp), exist_ok=True)
        prep(Image.open(f"{SRC}/images/A/{stem}.jpg").convert("RGB"), how).save(inp)
        t = time.time()
        subprocess.run(f'TESSDATA_PREFIX={TESS} timeout 900 xvfb-run -a "{AUD}" -batch -export '
                       f'-option org.audiveris.omr.text.Language.defaultSpecification=eng '
                       f'-output "{od}" "{inp}" > /dev/null 2>&1', shell=True)
        outs = sorted(glob.glob(f"{od}/{stem}*.mxl"), key=os.path.getsize, reverse=True)
        if outs and outs[0] != f"{od}/{stem}.mxl": shutil.copy(outs[0], f"{od}/{stem}.mxl")
        timing[f"{how}/{stem}"] = round(time.time() - t, 1)
    os.makedirs(f"{OUT}/audiveris_{how}", exist_ok=True)
    for f in glob.glob(f"{od}/*.mxl"): shutil.copy(f, f"{OUT}/audiveris_{how}/")
    score_dir(f"lowres_{how}_keeppart", od, ("lowres",))
json.dump(timing, open(f"{OUT}/timing_v3.json", "w"), indent=1)

# ---------------- print summary ----------------
import statistics as st
for label, r in results.items():
    for var in ("clean", "lowres"):
        v = [d["notes"]["omr_ned"] for k, d in r["scores"].items() if k.endswith(var) and d["notes"].get("omr_ned") is not None]
        if v: print(f"{label:<24} {var:<7} notes mean {st.mean(v):.3f} median {st.median(v):.3f}  n={len(v)}", flush=True)
sh(f"du -sh {OUT}")
