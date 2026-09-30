# Kaggle T4: read Korean worship lead sheets with open vision models -> JSON.
# Each model runs in its own subprocess so a failed install/OOM does not kill the rest.
# Output: /kaggle/working/vlm/<model>/<image>.json  (+ _timing.json)
import glob, json, os, shutil, subprocess, sys, textwrap, urllib.request

try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
print(f"PRECHECK gpu={shutil.which('nvidia-smi') is not None} internet={net}", flush=True)
if not (shutil.which("nvidia-smi") and net): sys.exit("PRECHECK failed")
subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv", shell=True)

W, OUT = "/kaggle/working", "/kaggle/working/vlm"
os.makedirs(OUT, exist_ok=True)
IMGS = sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True)
             if p.lower().endswith((".png", ".jpg", ".jpeg")))
print(f"images: {len(IMGS)}", flush=True)
assert IMGS, "no sheet images found"
SRC = os.path.dirname(IMGS[0])
PY = sys.executable

PROMPT = """이 악보 이미지를 읽고 JSON만 출력하세요. 설명 금지.
{"title": "", "key": "", "time_signature": "", "tempo": "", "sections": [{"tag": "", "lyrics": "", "chords": ""}]}
규칙:
- lyrics: 음표 아래 한국어 가사를 자연스러운 문장으로 이어 붙이세요. 음절 사이 하이픈(-)과 공백은 제거합니다.
- tag: 악보에 표시된 구간명(Verse, Chorus, V, C, A, B 등). 표시가 없으면 가사 흐름으로 추정하세요. 마디 번호는 쓰지 마세요.
- chords: 해당 구간의 코드 기호를 순서대로."""

def stage(name, code):
    p = f"{W}/{name}.py"
    open(p, "w").write(textwrap.dedent(code).replace("__PROMPT__", json.dumps(PROMPT)).replace("__SRC__", SRC).replace("__OUT__", OUT))
    print(f"\n===== {name}", flush=True)
    subprocess.run(f"{PY} {p} 2>&1 | grep -vE 'Warning|warn|it/s\\]|%\\|' | tail -30", shell=True)

QWEN = '''
import glob, json, os, subprocess, sys, time
subprocess.run(f"{sys.executable} -m pip install -q -U bitsandbytes accelerate", shell=True)
import torch
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration
MODEL = "MODEL_ID"
out = os.path.join("__OUT__", MODEL.split("/")[-1]); os.makedirs(out, exist_ok=True)
kw = dict(dtype=torch.float16, device_map="cuda:0")
LOAD
# 2048 visual tokens max (~1267x1267). A full A4 sheet downscales; research says small Hangul
# suffers, so this is the number to revisit if CER is poor.
proc = AutoProcessor.from_pretrained(MODEL, max_pixels=2048 * 28 * 28)
m = Qwen3VLForConditionalGeneration.from_pretrained(MODEL, **kw).eval()
timing = {}
for img in sorted(sorted(p for p in glob.glob("__SRC__/*") if p.lower().endswith((".png",".jpg",".jpeg")))):
    t = time.time()
    try:
        msg = [{"role": "user", "content": [{"type": "image", "url": img}, {"type": "text", "text": __PROMPT__}]}]
        inp = proc.apply_chat_template(msg, add_generation_prompt=True, tokenize=True,
                                       return_dict=True, return_tensors="pt").to(m.device)
        with torch.no_grad():
            g = m.generate(**inp, max_new_tokens=1500, do_sample=False)
        txt = proc.decode(g[0][inp["input_ids"].shape[1]:], skip_special_tokens=True)
    except Exception as e:
        txt = f"ERROR: {e!r}"[:400]
    torch.cuda.empty_cache()
    open(os.path.join(out, os.path.basename(img).rsplit(".", 1)[0] + ".json"), "w").write(txt)
    timing[os.path.basename(img)] = round(time.time() - t, 1)
    print(f"  {os.path.basename(img)}: {timing[os.path.basename(img)]}s", flush=True)
json.dump(timing, open(os.path.join(out, "_timing.json"), "w"), indent=1)
'''

# 4B in fp16 (~8GB) fits the T4; 8B needs 4-bit
stage("qwen4b", QWEN.replace("MODEL_ID", "Qwen/Qwen3-VL-4B-Instruct").replace("LOAD", ""))
stage("qwen8b", QWEN.replace("MODEL_ID", "Qwen/Qwen3-VL-8B-Instruct").replace("LOAD",
    'from transformers import BitsAndBytesConfig\n'
    'kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)\n'
    'kw.pop("dtype")'))

# PaddleOCR-VL: best published Korean edit distance among open OCR models. Text layer only,
# so it gets no JSON prompt - we score its raw Hangul against the reference lyrics.
stage("paddleocrvl", '''
import glob, json, os, subprocess, sys, time
subprocess.run(f'{sys.executable} -m pip install -q paddlepaddle-gpu paddleocr "paddlex[ocr]"', shell=True)
out = os.path.join("__OUT__", "PaddleOCR-VL"); os.makedirs(out, exist_ok=True)
from paddleocr import PaddleOCRVL
p = PaddleOCRVL()
timing = {}
for img in sorted(sorted(p for p in glob.glob("__SRC__/*") if p.lower().endswith((".png",".jpg",".jpeg")))):
    t = time.time()
    try:
        md = "\\n".join(str(getattr(r, "markdown", r)) for r in p.predict(img))
    except Exception as e:
        md = f"ERROR: {e!r}"[:400]
    open(os.path.join(out, os.path.basename(img).rsplit(".", 1)[0] + ".md"), "w").write(md)
    timing[os.path.basename(img)] = round(time.time() - t, 1)
    print(f"  {os.path.basename(img)}: {timing[os.path.basename(img)]}s", flush=True)
json.dump(timing, open(os.path.join(out, "_timing.json"), "w"), indent=1)
''')

subprocess.run(f"find {OUT} -type f | sort", shell=True)
