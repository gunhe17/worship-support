# Kaggle GPU: screen OCR replacements for the sets pipeline (LOG 56). Sample = every GT word box sets v8 got wrong + 300
# random GT word boxes (sets-gt.json, LOG 55). Readers (EasyOCR, PP-OCRv5 Korean) -> kind_of(text) -> C / L / O;
# VLMs (Qwen3-VL) see the box in red with its surroundings and answer CHORD / LYRIC / NOTATION / OTHER.
# Score = 3-class accuracy (C, L, O = N or X) on the sample, split into the v8-wrong part and the random part.
import glob, json, os, random, re, subprocess, sys, time
subprocess.run(f"{sys.executable} -m pip install -q -U easyocr 'transformers>=4.57' accelerate paddlepaddle paddleocr > /dev/null 2>&1", shell=True)
import cv2, numpy as np, torch
from PIL import Image

W = 2480
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
CHORD = re.compile(r"[(\[]?[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|[0-9]|[+\-°ø()])*(?:/[A-G][#b♯♭]?)?[)\]]?")
GT = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets-gt.json", recursive=True)))))
SETS = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets.json", recursive=True)))))["sheets"]


def kind_of(text):
    t = text.replace(" ", "").replace("I", "/").replace("|", "/")
    if CHORD.fullmatch(t): return "C"
    if HANGUL.search(text): return "L"
    return "O"


def load(path):
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR); f = W / img.shape[1]
    return cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)


# sample
random.seed(0); wrong, rest = [], []
for stem, rows in GT.items():
    bad = {tuple(f["box"]) for f in SETS[stem]["score"]["fails"] if f["kind"] == "w"}
    for kind, x0, y0, x1, y1, want in rows:
        if kind != "w": continue
        (wrong if (x0, y0, x1, y1) in bad else rest).append((stem, (x0, y0, x1, y1), want))
sample = [(*q, "wrong") for q in wrong] + [(*q, "random") for q in random.sample(rest, 300)]
print("sample", len(sample), "wrong", len(wrong), flush=True)
paths = {os.path.basename(q).rsplit(".", 1)[0]: q for q in glob.glob("/kaggle/input/**/*", recursive=True) if q.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}
pages = {stem: load(paths[stem]) for stem in {q[0] for q in sample}}


def crop(stem, b, pad=4):
    im = pages[stem]; H, W_ = im.shape[:2]
    return im[max(0, b[1] - pad):min(H, b[3] + pad), max(0, b[0] - pad):min(W_, b[2] + pad)]


def context(stem, b):
    im = pages[stem].copy(); H, W_ = im.shape[:2]; h = b[3] - b[1]
    cv2.rectangle(im, (b[0] - 3, b[1] - 3), (b[2] + 3, b[3] + 3), (0, 0, 255), 2)
    my, mx = max(120, 3 * h), 300
    c = im[max(0, b[1] - my):min(H, b[3] + my), max(0, b[0] - mx):min(W_, b[2] + mx)]
    return Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB))


# candidates
def easyocr_():
    import easyocr
    reader = easyocr.Reader(["ko", "en"], gpu=True, verbose=False)
    def read(stem, b):
        g = cv2.cvtColor(pages[stem], cv2.COLOR_BGR2GRAY)
        return kind_of(reader.recognize(g, horizontal_list=[[b[0] - 4, b[2] + 4, b[1] - 4, b[3] + 4]], free_list=[], detail=1, paragraph=False)[0][1])
    return read


def paddle_():
    from paddleocr import TextRecognition
    model = TextRecognition(model_name="korean_PP-OCRv5_mobile_rec")
    def read(stem, b):
        r = model.predict(input=crop(stem, b))[0]
        return kind_of(r["rec_text"] if "rec_text" in r else r.json["res"]["rec_text"])
    return read


PROMPT = ("This is part of a sheet of a Korean worship song. The red box marks one item. Answer with exactly one word: "
          "CHORD (a chord symbol written above a staff, e.g. G, Am7, D/F#, or a piece of one), "
          "LYRIC (lyric text under a staff: Korean or English syllables, or a lyric hyphen), "
          "NOTATION (music notation of the staff: note, rest, tie, tuplet number, accidental, dot), "
          "OTHER (title, credits, measure number, verse number, section label, dust).")


def qwen_(name):
    def make():
        from transformers import AutoModelForImageTextToText, AutoProcessor
        model = AutoModelForImageTextToText.from_pretrained(name, torch_dtype=torch.float16, device_map="cuda"); proc = AutoProcessor.from_pretrained(name)
        def read(stem, b):
            msgs = [{"role": "user", "content": [{"type": "image", "image": context(stem, b)}, {"type": "text", "text": PROMPT}]}]
            inputs = proc.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt").to("cuda")
            out = model.generate(**inputs, max_new_tokens=4, do_sample=False)
            a = proc.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].upper()
            return "C" if "CHORD" in a else "L" if "LYRIC" in a else "O"
        return read
    return make


CANDIDATES = {"easyocr": easyocr_, "paddle-ko-v5": paddle_, "qwen3-vl-2b": qwen_("Qwen/Qwen3-VL-2B-Instruct"), "qwen3-vl-4b": qwen_("Qwen/Qwen3-VL-4B-Instruct")}

# run
report = {}
for cname, make in CANDIDATES.items():
    try:
        read = make(); read(*sample[0][:2]); t0 = time.time(); got = []
        for i, (stem, b, want, part) in enumerate(sample, 1):
            got.append(read(stem, b))
            if i % 50 == 0 or i == len(sample): print(f"progress {i}/{len(sample)} {time.time() - t0:.0f}s {cname}", flush=True)
        dt = (time.time() - t0) / len(sample)
        truth = ["C" if q[2] == "C" else "L" if q[2] == "L" else "O" for q in sample]
        acc = {part: round(np.mean([g == t for g, t, q in zip(got, truth, sample) if q[3] == part]), 3) for part in ("wrong", "random")}
        conf = {}
        for g, t in zip(got, truth): conf[f"{t}>{g}"] = conf.get(f"{t}>{g}", 0) + 1
        report[cname] = dict(acc=acc, all=round(np.mean([g == t for g, t in zip(got, truth)]), 3), sec_per_box=round(dt, 3), confusion=conf)
    except Exception as e:
        import traceback; report[cname] = dict(error=repr(e)); print(cname, "ERROR", traceback.format_exc()[-1500:], flush=True)
    print("selftest", cname, json.dumps(report[cname]), flush=True)
    torch.cuda.empty_cache()
os.makedirs("/kaggle/working/out", exist_ok=True)
json.dump(report, open("/kaggle/working/out/bench.json", "w"), indent=1)
