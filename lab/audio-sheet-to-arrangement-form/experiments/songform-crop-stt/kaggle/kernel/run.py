# Kaggle GPU kernel: songform extraction -> padded crops -> per-section STT (no review step).
# Stages run as separate processes because SongFormer needs transformers<4.50 and qwen-asr may need a newer one.
# Output: /kaggle/working/out/<song>.json, /kaggle/working/out/timing.json
import glob, json, os, shutil, subprocess, sys, textwrap, urllib.request

try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
gpu = shutil.which("nvidia-smi") is not None
print(f"PRECHECK gpu={gpu} internet={net}", flush=True)
if not (gpu and net):
    sys.exit("PRECHECK failed")

W, OUT = "/kaggle/working", "/kaggle/working/out"
os.makedirs(OUT, exist_ok=True); os.makedirs(f"{W}/crops", exist_ok=True)
SRC = glob.glob("/kaggle/input/**/songs.json", recursive=True)[0].rsplit("/", 1)[0]
PY = sys.executable

def sh(cmd):
    print("$", cmd[:200], flush=True); subprocess.run(cmd, shell=True, check=False)

def stage(name, code):
    p = f"{W}/{name}.py"; open(p, "w").write(textwrap.dedent(code))
    sh(f"{PY} {p} 2>&1 | grep -vE 'Warning|warn' | tail -40")

COMMON = f'''
import glob, json, os, time
SRC, W, OUT = "{SRC}", "{W}", "{OUT}"
SONGS = json.load(open(f"{{SRC}}/songs.json"))
PAD = 1.5
def tlog(k, v):
    p = f"{{OUT}}/timing.json"; d = json.load(open(p)) if os.path.exists(p) else {{}}
    d[k] = round(v, 1); json.dump(d, open(p, "w"), indent=1)
'''

# ---- Stage A: SongFormer (180s window)
sh(f"{PY} -m pip install -q 'transformers<4.50' muq msaf ema_pytorch loguru einops omegaconf x_transformers soundfile demucs > {OUT}/pip_a.log 2>&1")
stage("a_songformer", COMMON + '''
import sys, torch
from huggingface_hub import snapshot_download
from transformers import AutoModel
d = snapshot_download("ASLP-lab/SongFormer", ignore_patterns=["SongFormer.pt", "SongFormer.safetensors"])
sys.path.append(d); os.environ["SONGFORMER_LOCAL_DIR"] = d
m = AutoModel.from_pretrained(d, trust_remote_code=True, low_cpu_mem_usage=False).to("cuda").eval()
m.config.win_size = m.config.hop_size = 180
for s in SONGS:
    t = time.time()
    segs = [x for x in m(f"{SRC}/audio/{s['id']}.wav") if x["end"] - x["start"] > 0.5]
    json.dump(segs, open(f"{OUT}/{s['id']}.segments.json", "w"), indent=1)
    tlog(f"songformer/{s['id']}", time.time() - t); print("songformer", s["id"], len(segs), flush=True)
''')

# ---- Stage B: Demucs vocals + padded crops (16 kHz mono)
stage("b_crops", COMMON + '''
import librosa, soundfile as sf, torch
from demucs.api import Separator
sep = Separator(model="htdemucs", device="cuda")
for s in SONGS:
    t = time.time(); n = s["id"]
    mix, _ = librosa.load(f"{SRC}/audio/{n}.wav", sr=16000, mono=True)
    _, stems = sep.separate_audio_file(f"{SRC}/audio/{n}.wav")
    voc = librosa.resample(stems["vocals"].mean(0).numpy(), orig_sr=sep.samplerate, target_sr=16000)
    dur = len(mix) / 16000
    segs = json.load(open(f"{OUT}/{n}.segments.json"))
    for i, g in enumerate(segs):
        a, b = max(0.0, g["start"] - PAD), min(dur, g["end"] + PAD)
        g["crop_start"], g["crop_end"] = round(a, 2), round(b, 2)
        for inp, y in (("mix", mix), ("vocals", voc)):
            sf.write(f"{W}/crops/{n}.{i:02d}.{inp}.wav", y[int(a * 16000):int(b * 16000)], 16000)
    json.dump(segs, open(f"{OUT}/{n}.segments.json", "w"), indent=1)
    tlog(f"demucs+crop/{n}", time.time() - t); print("crops", n, len(segs), flush=True)
''')

# ---- Stage C: STT on every crop (3 models x 2 inputs)
sh(f"{PY} -m pip install -q -U qwen-asr faster-whisper > {OUT}/pip_c.log 2>&1")
stage("c_stt", COMMON + '''
import torch
res = {}
def put(n, i, model, inp, text):
    res.setdefault(n, {}).setdefault(i, {}).setdefault(model, {})[inp] = text
def each():
    for s in SONGS:
        n = s["id"]
        for i in range(len(json.load(open(f"{OUT}/{n}.segments.json")))):
            for inp in ("mix", "vocals"):
                yield n, i, inp, f"{W}/crops/{n}.{i:02d}.{inp}.wav"
def run(model, fn):
    t = time.time()
    for n, i, inp, p in each():
        try: put(n, i, model, inp, fn(p))
        except Exception as e: put(n, i, model, inp, f"ERROR: {e!r}"[:300])
    tlog(f"stt/{model}", time.time() - t); print("stt", model, "done", flush=True)

from faster_whisper import WhisperModel
fw = WhisperModel("large-v3", device="cuda", compute_type="float16")
run("whisper-large-v3", lambda p: " ".join(x.text.strip() for x in fw.transcribe(p, language="ko", vad_filter=False, condition_on_previous_text=False, beam_size=5)[0]))
del fw; torch.cuda.empty_cache()

from transformers import pipeline, GenerationConfig
asr = pipeline("automatic-speech-recognition", model="ghost613/whisper-large-v3-turbo-korean", torch_dtype=torch.float16, device="cuda:0")
asr.model.generation_config = GenerationConfig.from_pretrained("openai/whisper-large-v3-turbo")
run("whisper-turbo-ko-ghost613", lambda p: asr(p, chunk_length_s=30, generate_kwargs={"language": "ko", "task": "transcribe"})["text"].strip())
del asr; torch.cuda.empty_cache()

from qwen_asr import Qwen3ASRModel
qm = Qwen3ASRModel.from_pretrained("Qwen/Qwen3-ASR-1.7B", dtype=torch.float16, device_map="cuda:0", max_inference_batch_size=8, max_new_tokens=512)
run("qwen3-asr-1.7b", lambda p: qm.transcribe(audio=p, language="Korean")[0].text.strip())

for s in SONGS:
    n = s["id"]; segs = json.load(open(f"{OUT}/{n}.segments.json"))
    for i, g in enumerate(segs):
        g["stt"] = res.get(n, {}).get(i, {})
    json.dump({**s, "pad": PAD, "sections": segs}, open(f"{OUT}/{n}.json", "w"), ensure_ascii=False, indent=1)
print("wrote", len(SONGS), flush=True)
''')
sh(f"ls -la {OUT}; cat {OUT}/timing.json")
