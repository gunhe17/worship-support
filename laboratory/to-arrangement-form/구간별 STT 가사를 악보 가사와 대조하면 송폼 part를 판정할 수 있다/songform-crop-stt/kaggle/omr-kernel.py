# Kaggle: run Audiveris (the only free OMR claiming lyrics + CJK) on Korean worship sheets
# and export MusicXML. Question under test: does .mxl carry Korean lyrics and the repeat
# structure (measures, D.S., 1st/2nd endings) that vision LLMs get wrong?
import glob, os, shutil, subprocess, sys, time, urllib.request

def sh(cmd, **kw):
    print("$", cmd[:160], flush=True)
    return subprocess.run(cmd, shell=True, **kw)

try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
print(f"PRECHECK internet={net}", flush=True)
if not net: sys.exit("needs internet")

W, OUT = "/kaggle/working", "/kaggle/working/omr"
os.makedirs(OUT, exist_ok=True)
sh("cat /etc/os-release | grep VERSION_ID")

# Audiveris needs a Java runtime, Tesseract with Korean data, and a display even in batch mode
sh("apt-get -qq update && apt-get -qq install -y openjdk-21-jre tesseract-ocr tesseract-ocr-kor tesseract-ocr-eng xvfb libfreetype6 > /dev/null 2>&1")
ver = "ubuntu24.04" if "24.04" in open("/etc/os-release").read() else "ubuntu22.04"
deb = f"Audiveris-5.11.0-{ver}-x86_64.deb"
sh(f"wget -q https://github.com/Audiveris/audiveris/releases/download/5.11.0/{deb} -O /tmp/{deb}")
sh(f"apt-get install -y /tmp/{deb} 2>&1 | tail -5")
sh("java -version 2>&1 | head -2")
sh("dpkg -L audiveris 2>/dev/null | grep -iE 'bin/|\\.sh$' | head -10")
# the .deb does not put the launcher on PATH, so locate it
cand = [p for p in glob.glob("/opt/**/*", recursive=True) + glob.glob("/usr/**/audiveris*", recursive=True)
        if os.path.isfile(p) and os.access(p, os.X_OK) and "audiveris" in os.path.basename(p).lower()]
print("candidates:", cand[:10], flush=True)
AUD = cand[0] if cand else "audiveris"
print("AUD =", AUD, flush=True)
sh(f'"{AUD}" -help 2>&1 | head -15')
# Audiveris drives Tesseract in legacy mode; Ubuntu's tesseract-ocr-kor ships LSTM-only data,
# which fails with "Could not initialize TessBaseAPI languages: kor+eng in legacy mode".
# The tesseract-ocr/tessdata repo carries the combined legacy+LSTM files.
tess = "/kaggle/working/tessdata"; os.makedirs(tess, exist_ok=True)
for lg in ("kor", "eng"):
    sh(f"wget -q https://github.com/tesseract-ocr/tessdata/raw/main/{lg}.traineddata -O {tess}/{lg}.traineddata")
sh(f"ls -la {tess}")
print("TESSDATA_PREFIX =", tess, "| kor:", os.path.exists(f"{tess}/kor.traineddata"), flush=True)

# Audiveris is tuned for ~300 DPI scans; upscale the small ones so staff lines are thick enough
from PIL import Image
imgs = []
for p in sorted(glob.glob("/kaggle/input/**/*", recursive=True)):
    if not p.lower().endswith((".png", ".jpg", ".jpeg")): continue
    im = Image.open(p).convert("RGB")
    if im.width < 1600:
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    q = f"{W}/in_{os.path.basename(p).rsplit('.', 1)[0]}.png"
    im.save(q); imgs.append(q)
    print(f"  {os.path.basename(p)} -> {im.size}", flush=True)

env = f'TESSDATA_PREFIX={tess}'
LANG = "org.audiveris.omr.text.Language.defaultSpecification"
for q in imgs:
    t = time.time()
    r = sh(f'{env} xvfb-run -a "{AUD}" -batch -export -option {LANG}=kor+eng '
           f'-output {OUT} "{q}" 2>&1 | tail -6', capture_output=True, text=True)
    print(f"  {os.path.basename(q)}: {time.time()-t:.0f}s\n{(r.stdout or '')[-500:]}", flush=True)

sh(f"find {OUT} -name '*.mxl' -o -name '*.xml' | head -40")
sh(f"du -sh {OUT}")
