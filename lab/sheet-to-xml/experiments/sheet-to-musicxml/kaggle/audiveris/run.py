# Kaggle CPU kernel: sheet image -> MusicXML accuracy, candidate 1 = Audiveris 5.11.
#  A) ground-truth set: 20 public-domain lead sheets from OpenEWLD rendered with Verovio
#     (clean ~200dpi PNG, lowres 900px JPEG q60); the source MusicXML is the answer key.
#  B) real worship sheets (14 images, no answer key): rhythm-consistency + key only.
# Scores with musicdiff OMR-NED per detail level. Outputs under /kaggle/working/out/.
import glob, json, os, random, re, shutil, signal, subprocess, sys, time, zipfile

def sh(cmd):
    print("$", cmd[:170], flush=True)
    return subprocess.run(cmd, shell=True)

W = "/kaggle/working"; OUT = f"{W}/out"
for d in ("gt", "images/A", "images/B", "audiveris/A", "audiveris/B"):
    os.makedirs(f"{OUT}/{d}", exist_ok=True)

sh(f"{sys.executable} -m pip install -q musicdiff verovio cairosvg pillow > {OUT}/pip.log 2>&1")
sh("apt-get -qq update > /dev/null 2>&1; apt-get -qq install -y tesseract-ocr xvfb libcairo2 librsvg2-bin libgtk-3-0 libfreetype6 fontconfig > /dev/null 2>&1")  # Audiveris JNA loads libgtk-3 at startup even in -batch
import music21 as m21, verovio, musicdiff
from PIL import Image

# ---------------- A) ground-truth set ----------------
# clone + intermediates live in /tmp so the kernel output stays small (only out/ is kept)
sh("git clone -q --depth 1 https://github.com/00sapo/OpenEWLD /tmp/ewld")
files = sorted(glob.glob("/tmp/ewld/dataset/**/*.mxl", recursive=True))
random.Random(0).shuffle(files)
tk = verovio.toolkit()
tk.setOptions({"pageWidth": 2100, "pageHeight": 2970, "scale": 45, "footer": "none", "breaks": "auto"})

def to_png(svg, path, width):
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode(), write_to=path, output_width=width, background_color="white")
    except Exception:
        tmp = path + ".svg"; open(tmp, "w").write(svg)
        subprocess.run(["rsvg-convert", "-w", str(width), "-b", "white", "-o", path, tmp]); os.remove(tmp)

setA = []
for f in files:
    if len(setA) >= 20: break
    try:
        s = m21.converter.parse(f)
        if len(s.parts) != 1: continue
        ms = s.parts[0].getElementsByClass("Measure")
        ts = {t.ratioString for t in s.recurse().getElementsByClass("TimeSignature")}
        if not (16 <= len(ms) <= 48) or not ts or not ts <= {"3/4", "4/4"}: continue
        if len(s.recurse().getElementsByClass("ChordSymbol")) < 4: continue
        if sum(1 for n in s.recurse().notes if n.lyrics) < 10: continue
        sid = f"a{len(setA):02d}"
        gt = f"{OUT}/gt/{sid}.musicxml"
        s.write("musicxml", gt)
        if not tk.loadFile(gt) or tk.getPageCount() != 1: os.remove(gt); continue
        svg = tk.renderToSVG(1)
        to_png(svg, f"{OUT}/images/A/{sid}_clean.png", 1650)
        im = Image.open(f"{OUT}/images/A/{sid}_clean.png").convert("RGB")
        im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS).save(f"{OUT}/images/A/{sid}_lowres.jpg", quality=60)
        setA.append({"id": sid, "src": os.path.relpath(f, "/tmp/ewld/dataset"), "measures": len(ms), "ts": sorted(ts)})
        print(f"  {sid}: {setA[-1]['src'][:70]}  m={len(ms)}", flush=True)
    except Exception as e:
        print("  skip", os.path.basename(f), repr(e)[:80])
json.dump(setA, open(f"{OUT}/setA.json", "w"), indent=1)
print(f"set A: {len(setA)} songs", flush=True)

# ---------------- B) real sheets ----------------
for p in sorted(glob.glob("/kaggle/input/**/*", recursive=True)):
    if p.lower().endswith((".png", ".jpg", ".jpeg")):
        shutil.copy(p, f"{OUT}/images/B/{os.path.basename(p)}")

# ---------------- Audiveris ----------------
deb = "Audiveris-5.11.0-ubuntu22.04-x86_64.deb" if "22.04" in open("/etc/os-release").read() else "Audiveris-5.11.0-ubuntu24.04-x86_64.deb"
sh(f"wget -q https://github.com/Audiveris/audiveris/releases/download/5.11.0/{deb} -O /tmp/{deb} && apt-get install -y /tmp/{deb} > /dev/null 2>&1")
AUD = next((p for p in glob.glob("/opt/**/bin/Audiveris", recursive=True)), None)
print("AUD =", AUD, flush=True)
# Audiveris drives Tesseract in legacy mode -> needs the combined legacy+LSTM traineddata
TESS = "/tmp/tessdata"; os.makedirs(TESS, exist_ok=True)
for lg in ("kor", "eng"):
    sh(f"wget -q https://github.com/tesseract-ocr/tessdata/raw/main/{lg}.traineddata -O {TESS}/{lg}.traineddata")

def audiveris(img, outdir, lang):
    im = Image.open(img).convert("RGB")
    if im.width < 1600:  # Audiveris is tuned for ~300dpi scans
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    stem = os.path.basename(img).rsplit(".", 1)[0]
    inp = f"/tmp/aud_in/{stem}.png"; os.makedirs(os.path.dirname(inp), exist_ok=True); im.save(inp)
    t = time.time()
    subprocess.run(f'TESSDATA_PREFIX={TESS} timeout 900 xvfb-run -a "{AUD}" -batch -export '
                   f'-option org.audiveris.omr.text.Language.defaultSpecification={lang} '
                   f'-output "{outdir}" "{inp}" > "{outdir}/{stem}.stdout" 2>&1', shell=True)
    outs = sorted(glob.glob(f"{outdir}/{stem}*.mxl"), key=os.path.getsize, reverse=True)
    if outs and outs[0] != f"{outdir}/{stem}.mxl": shutil.copy(outs[0], f"{outdir}/{stem}.mxl")
    return time.time() - t, bool(outs)

timing = {}
for img in sorted(glob.glob(f"{OUT}/images/A/*")):
    timing[os.path.basename(img)] = audiveris(img, f"{OUT}/audiveris/A", "eng")
for img in sorted(glob.glob(f"{OUT}/images/B/*")):
    timing[os.path.basename(img)] = audiveris(img, f"{OUT}/audiveris/B", "kor+eng")
json.dump(timing, open(f"{OUT}/audiveris/timing.json", "w"), indent=1)
print("audiveris done:", sum(ok for _, ok in timing.values()), "/", len(timing), flush=True)

# ---------------- scoring set A (musicdiff OMR-NED) ----------------
DL = musicdiff.DetailLevel
DETAILS = {"notes": DL.NotesAndRests, "signatures": DL.Signatures, "barlines": DL.Barlines,
           "chords": DL.ChordSymbols, "lyrics": DL.Lyrics, "all": DL.AllObjects}
class TO(Exception): pass
signal.signal(signal.SIGALRM, lambda *a: (_ for _ in ()).throw(TO()))
def omr_ned(pred, gt, detail):
    if not os.path.exists(pred): return {"omr_ned": 1.0, "failed": "no output"}
    signal.alarm(600)
    try:
        m = musicdiff._diff_omr_ned_metrics(pred, gt, detail)
        return None if m is None else {"omr_ned": round(m.omr_ned, 4), "gt_syms": m.gt_numsyms, "pred_syms": m.pred_numsyms,
                                       "edits": m.omr_edit_distance}
    except TO:
        return {"omr_ned": None, "failed": "timeout"}
    except Exception as e:
        return {"omr_ned": None, "failed": repr(e)[:120]}
    finally:
        signal.alarm(0)

scores = {}
for a in setA:
    for var in ("clean", "lowres"):
        key = f"{a['id']}_{var}"
        scores[key] = {k: omr_ned(f"{OUT}/audiveris/A/{key}.mxl", f"{OUT}/gt/{a['id']}.musicxml", d) for k, d in DETAILS.items()}
        print(f"  {key}: " + " ".join(f"{k}={(v or {}).get('omr_ned')}" for k, v in scores[key].items()), flush=True)
json.dump(scores, open(f"{OUT}/scores_audiveris_A.json", "w"), indent=1)

# ---------------- set B: rhythm consistency (no answer key needed) ----------------
def load_xml(f):
    z = zipfile.ZipFile(f); n = [x for x in z.namelist() if x.endswith(".xml") and "container" not in x][0]
    return z.read(n).decode("utf-8", "ignore")
def rhythm_check(x):
    div = int((re.search(r"<divisions>(\d+)</divisions>", x) or [0, 1])[1])
    b = re.search(r"<beats>(\d+)</beats>\s*<beat-type>(\d+)</beat-type>", x, re.S)
    beats, btype = (int(b[1]), int(b[2])) if b else (4, 4)
    expect = beats * div * 4 // btype
    parts = re.split(r"(<measure(?:\s[^>]*)?>)", x)[1:]  # not <measure-numbering>
    ms = [h + body.split("</measure>")[0] for h, body in zip(parts[::2], parts[1::2])]
    ok = partial = bad = 0
    for i, mt in enumerate(ms):
        cur = 0
        for tag, body in re.findall(r"<(note|backup|forward)\b[^>]*>(.*?)</\1>", mt, re.S):
            d = re.search(r"<duration>(\d+)</duration>", body)
            if not d: continue
            v = int(d[1]); cur += -v if tag == "backup" else (0 if (tag == "note" and "<chord" in body) else v)
        if cur == expect: ok += 1
        elif i in (0, len(ms) - 1) and 0 < cur < expect: partial += 1
        else: bad += 1
    k = re.search(r"<fifths>(-?\d+)</fifths>", x)
    return {"measures": len(ms), "ok": ok, "partial": partial, "bad": bad, "fifths": int(k[1]) if k else None}
rb = {}
for f in sorted(glob.glob(f"{OUT}/audiveris/B/*.mxl")):
    try: rb[os.path.basename(f)] = rhythm_check(load_xml(f))
    except Exception as e: rb[os.path.basename(f)] = {"error": repr(e)[:100]}
# same check on set A predictions, so B can be read against A's known accuracy
ra = {}
for f in sorted(glob.glob(f"{OUT}/audiveris/A/*.mxl")):
    try: ra[os.path.basename(f)] = rhythm_check(load_xml(f))
    except Exception as e: ra[os.path.basename(f)] = {"error": repr(e)[:100]}
json.dump({"A": ra, "B": rb}, open(f"{OUT}/rhythm_audiveris.json", "w"), indent=1)
print("rhythm B:", json.dumps(rb)[:600], flush=True)
sh(f"du -sh {OUT}; ls {OUT}/audiveris/A | head")
