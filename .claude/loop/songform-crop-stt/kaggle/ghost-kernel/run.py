# Re-run ghost613 only (v1 failed: qwen-asr upgraded transformers and the generation config was rejected).
# Uses Kaggle's default transformers (worked in the earlier STT v2 run). Crops rebuilt from v1 segments (crop_start/crop_end).
import glob, json, os, shutil, subprocess, sys, time, urllib.request
try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
print(f"PRECHECK gpu={shutil.which('nvidia-smi') is not None} internet={net}", flush=True)
subprocess.run(f"{sys.executable} -m pip install -q demucs soundfile", shell=True)
import torch, librosa, soundfile as sf, transformers
from demucs.api import Separator
from transformers import pipeline, GenerationConfig
print("transformers", transformers.__version__, flush=True)
SRC = glob.glob("/kaggle/input/**/songs.json", recursive=True)[0].rsplit("/", 1)[0]
SEG = glob.glob("/kaggle/input/**/out/*.segments.json", recursive=True)
OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
segfile = {os.path.basename(p)[:-len(".segments.json")]: p for p in SEG}
asr = pipeline("automatic-speech-recognition", model="ghost613/whisper-large-v3-turbo-korean", torch_dtype=torch.float16, device="cuda:0")
asr.model.generation_config = GenerationConfig.from_pretrained("openai/whisper-large-v3-turbo")
sep = Separator(model="htdemucs", device="cuda")
t0 = time.time()
for s in json.load(open(f"{SRC}/songs.json")):
    n = s["id"]; segs = json.load(open(segfile[n]))
    mix, _ = librosa.load(f"{SRC}/audio/{n}.wav", sr=16000, mono=True)
    _, stems = sep.separate_audio_file(f"{SRC}/audio/{n}.wav")
    voc = librosa.resample(stems["vocals"].mean(0).numpy(), orig_sr=sep.samplerate, target_sr=16000)
    res = {}
    for i, g in enumerate(segs):
        a, b = int(g["crop_start"] * 16000), int(g["crop_end"] * 16000)
        for inp, y in (("mix", mix), ("vocals", voc)):
            try:
                t = asr({"raw": y[a:b].copy(), "sampling_rate": 16000}, chunk_length_s=30, generate_kwargs={"language": "ko", "task": "transcribe"})["text"].strip()
            except Exception as e:
                t = f"ERROR: {e!r}"[:300]
            res.setdefault(str(i), {})[inp] = t
    json.dump(res, open(f"{OUT}/{n}.ghost613.json", "w"), ensure_ascii=False, indent=1)
    print("done", n, len(segs), flush=True)
json.dump({"stt/whisper-turbo-ko-ghost613 (incl. demucs)": round(time.time() - t0, 1)}, open(f"{OUT}/timing.json", "w"))
