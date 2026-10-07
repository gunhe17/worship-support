# Kaggle CPU kernel: best pipeline on the REAL worship lead sheets (single-voice melody + chords + Korean lyrics).
# Pipeline: upscale to ~2900px wide if width < 1600 -> Audiveris 5.11 (kor+eng) -> keep the part with the most notes.
# No answer key exists for these copyrighted sheets, so we report checks that need none:
# parts before cleanup, measures, key (fifths), time signature, rhythm consistency, note / chord / lyric counts.
# Output: /kaggle/working/out/worship.json (+ the cleaned MusicXML files, kept private in this kernel)
import glob, json, os, re, shutil, subprocess, sys, time

def sh(cmd):
    print("$", cmd[:170], flush=True); return subprocess.run(cmd, shell=True)

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/xml", exist_ok=True)
sh(f"{sys.executable} -m pip install -q pillow > /dev/null 2>&1")
sh("apt-get -qq update > /dev/null 2>&1; apt-get -qq install -y tesseract-ocr xvfb libgtk-3-0 libfreetype6 fontconfig > /dev/null 2>&1")
import music21 as m21
from PIL import Image

deb = "Audiveris-5.11.0-ubuntu22.04-x86_64.deb" if "22.04" in open("/etc/os-release").read() else "Audiveris-5.11.0-ubuntu24.04-x86_64.deb"
sh(f"wget -q https://github.com/Audiveris/audiveris/releases/download/5.11.0/{deb} -O /tmp/{deb} && apt-get install -y /tmp/{deb} > /dev/null 2>&1")
AUD = next(iter(glob.glob("/opt/**/bin/Audiveris", recursive=True)), None)
TESS = "/tmp/tessdata"; os.makedirs(TESS, exist_ok=True)
for lg in ("kor", "eng"):
    sh(f"wget -q https://github.com/tesseract-ocr/tessdata/raw/main/{lg}.traineddata -O {TESS}/{lg}.traineddata")
print("AUD =", AUD, flush=True)

def rhythm(s):
    """per-measure status: ok (duration == time signature), partial (pickup / last bar), short, long."""
    ok = bad = partial = 0; per = []
    ms = list(s.parts[0].getElementsByClass("Measure")) if s.parts else []
    for i, m in enumerate(ms):
        ts = m.getContextByClass("TimeSignature")
        expect = ts.barDuration.quarterLength if ts else 4.0
        dur = m.duration.quarterLength
        if abs(dur - expect) < 1e-6: ok += 1; st = "ok"
        elif i in (0, len(ms) - 1) and 0 < dur < expect: partial += 1; st = "partial"
        else: bad += 1; st = "short" if dur < expect else "long"
        per.append({"n": i + 1, "status": st, "dur": round(float(dur), 3), "expect": round(float(expect), 3)})
    return len(ms), ok, partial, bad, per

res = {}
for img in sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg"))):
    stem = os.path.basename(img).rsplit(".", 1)[0]
    im = Image.open(img).convert("RGB"); w0 = im.width
    # fixed x3 made a 1447px sheet 4341px wide and Audiveris exited with no output -> scale to ~2900px instead
    if im.width < 1600:
        k = 2900 / im.width; im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    inp = f"/tmp/in/{stem}.png"; os.makedirs("/tmp/in", exist_ok=True); im.save(inp)
    od = f"/tmp/aud/{stem}"; os.makedirs(od, exist_ok=True)
    t = time.time()
    subprocess.run(f'TESSDATA_PREFIX={TESS} timeout 900 xvfb-run -a "{AUD}" -batch -export '
                   f'-option org.audiveris.omr.text.Language.defaultSpecification=kor+eng '
                   f'-output "{od}" "{inp}" > /dev/null 2>&1', shell=True)
    secs = round(time.time() - t, 1)
    outs = sorted(glob.glob(f"{od}/*.mxl"), key=os.path.getsize, reverse=True)
    r = {"width_in": w0, "width_used": im.width, "upscaled": w0 < 1600, "seconds": secs, "movements": len(outs)}
    if not outs:
        r["error"] = "no output"; res[stem] = r; print(stem, r, flush=True); continue
    try:
        s = m21.converter.parse(outs[0])
        parts = list(s.parts); r["parts_before"] = len(parts)
        best = max(parts, key=lambda p: len(p.recurse().notes))
        for p in parts:
            if p is not best: s.remove(p)
        ks = s.recurse().getElementsByClass("KeySignature"); tsig = s.recurse().getElementsByClass("TimeSignature")
        n, ok, partial, bad, per = rhythm(s)
        r.update({"measures": n, "rhythm_ok": ok, "rhythm_partial": partial, "rhythm_bad": bad,
                  "rhythm_ok_rate": round(ok / n, 3) if n else None, "per_measure": per,
                  "fifths": ks[0].sharps if ks else None, "time": tsig[0].ratioString if tsig else None,
                  "notes": len([x for x in s.recurse().notes if not x.isRest]),
                  "chords": len(s.recurse().getElementsByClass("ChordSymbol")),
                  "lyric_notes": sum(1 for x in s.recurse().notes if x.lyrics)})
        s.write("musicxml", f"{OUT}/xml/{stem}.musicxml")
    except Exception as e:
        r["error"] = repr(e)[:160]
    res[stem] = r
    print(stem, {k: r.get(k) for k in ("parts_before", "measures", "fifths", "time", "rhythm_ok_rate", "notes", "chords", "seconds")}, flush=True)
json.dump(res, open(f"{OUT}/worship.json", "w"), ensure_ascii=False, indent=1)
