
import glob, json, os, subprocess, sys, time
subprocess.run(f'{sys.executable} -m pip install -q paddlepaddle-gpu paddleocr "paddlex[ocr]"', shell=True)
out = os.path.join("/kaggle/working/vlm", "PaddleOCR-VL"); os.makedirs(out, exist_ok=True)
from paddleocr import PaddleOCRVL
p = PaddleOCRVL()
timing = {}
for img in sorted(sorted(p for p in glob.glob("/kaggle/input/datasets/gunhe17/worship-sheet-images/*") if p.lower().endswith((".png",".jpg",".jpeg")))):
    t = time.time()
    try:
        md = "\n".join(str(getattr(r, "markdown", r)) for r in p.predict(img))
    except Exception as e:
        md = f"ERROR: {e!r}"[:400]
    open(os.path.join(out, os.path.basename(img).rsplit(".", 1)[0] + ".md"), "w").write(md)
    timing[os.path.basename(img)] = round(time.time() - t, 1)
    print(f"  {os.path.basename(img)}: {timing[os.path.basename(img)]}s", flush=True)
json.dump(timing, open(os.path.join(out, "_timing.json"), "w"), indent=1)
