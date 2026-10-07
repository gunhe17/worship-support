# Kaggle CPU kernel: side-by-side images for the (private) report — original worship sheet vs the
# Audiveris MusicXML rendered by Verovio, with measures whose durations don't match the time signature
# colored orange. Output: out/<stem>_orig.jpg, out/<stem>_xml.jpg, out/manifest.json
import glob, io, json, os, subprocess, sys

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
subprocess.run(f"{sys.executable} -m pip install -q verovio cairosvg pillow > /dev/null 2>&1", shell=True)
subprocess.run("apt-get -qq update > /dev/null 2>&1; apt-get -qq install -y libcairo2 fonts-noto-cjk > /dev/null 2>&1", shell=True)
import music21 as m21, verovio, cairosvg
from PIL import Image

WJ = glob.glob("/kaggle/input/**/out/worship.json", recursive=True)[0]
XD = os.path.dirname(WJ) + "/xml"
res = json.load(open(WJ))
imgs = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True)
        if p.lower().endswith((".png", ".jpg", ".jpeg"))}
BAD = "#e0561b"; WIDTH = 1000

tk = verovio.toolkit()
tk.setOptions({"pageWidth": 2100, "pageHeight": 2970, "scale": 40, "footer": "none", "header": "none",
               "adjustPageHeight": True, "breaks": "auto"})

manifest = []
for stem, r in sorted(res.items()):
    xml = f"{XD}/{stem}.musicxml"
    if stem not in imgs or not os.path.exists(xml): print("skip", stem); continue
    im = Image.open(imgs[stem]).convert("RGB")
    im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS).save(f"{OUT}/{stem}_orig.jpg", quality=80)
    s = m21.converter.parse(xml)
    per = r.get("per_measure", [])
    for m, st in zip(s.parts[0].getElementsByClass("Measure"), per):
        if st["status"] in ("short", "long"):
            for n in m.recurse().notesAndRests: n.style.color = BAD
    colored = f"/tmp/{stem}.musicxml"; s.write("musicxml", colored)
    if not tk.loadFile(colored): print("load fail", stem); continue
    pages = [Image.open(io.BytesIO(cairosvg.svg2png(bytestring=tk.renderToSVG(p).encode(), output_width=WIDTH,
                                                     background_color="white"))).convert("RGB")
             for p in range(1, tk.getPageCount() + 1)]
    out = Image.new("RGB", (WIDTH, sum(p.height for p in pages)), "white"); y = 0
    for p in pages: out.paste(p, (0, y)); y += p.height
    out.save(f"{OUT}/{stem}_xml.jpg", quality=80)
    manifest.append({"stem": stem, "pages": len(pages), "bad": sum(st["status"] in ("short", "long") for st in per)})
    print(stem, manifest[-1], flush=True)
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
