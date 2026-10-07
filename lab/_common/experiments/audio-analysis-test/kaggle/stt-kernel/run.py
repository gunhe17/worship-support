# Kaggle GPU kernel: Korean lyric transcription test (no known lyrics).
# 3 songs x 3 models x 2 inputs (mix / Demucs vocals). Outputs: /kaggle/working/stt/<song>.<model>.<input>.json
import glob, json, os, subprocess, sys, time, shutil, urllib.request

def sh(cmd):
    print("$", cmd, flush=True); subprocess.run(cmd, shell=True, check=False)

try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
gpu = shutil.which("nvidia-smi") is not None
print(f"PRECHECK gpu={gpu} internet={net}", flush=True)
if not (gpu and net):
    sys.exit("PRECHECK failed")

W = "/kaggle/working"; OUT = f"{W}/stt"; os.makedirs(OUT, exist_ok=True)
sh(f"{sys.executable} -m pip install -q -U faster-whisper demucs soundfile > {OUT}/pip.log 2>&1")

src = glob.glob("/kaggle/input/**/audio", recursive=True)[0]
songs = sorted(p for p in glob.glob(f"{src}/*.wav") if not p.endswith("synth.wav"))

# ---- inputs: mix (16k mono) and Demucs vocals (16k mono)
import torch, librosa, soundfile as sf, numpy as np
inputs = {}
from demucs.api import Separator
sep = Separator(model="htdemucs", device="cuda")
for p in songs:
    n = os.path.basename(p)[:-4]
    y, _ = librosa.load(p, sr=16000, mono=True)
    sf.write(f"{W}/{n}.mix.wav", y, 16000)
    _, stems = sep.separate_audio_file(p)
    v = librosa.resample(stems["vocals"].mean(0).numpy(), orig_sr=sep.samplerate, target_sr=16000)
    sf.write(f"{W}/{n}.vocals.wav", v, 16000)
    inputs[n] = {"mix": f"{W}/{n}.mix.wav", "vocals": f"{W}/{n}.vocals.wav"}
del sep; torch.cuda.empty_cache()

def save(n, model, inp, segs, secs):
    json.dump({"song": n, "model": model, "input": inp, "seconds": round(secs, 1),
               "text": " ".join(s["text"].strip() for s in segs), "segments": segs},
              open(f"{OUT}/{n}.{model}.{inp}.json", "w"), ensure_ascii=False, indent=1)
    print(f"[{model}/{inp}] {n}: {secs:.1f}s, {len(segs)} segs", flush=True)

def run_all(model, fn):
    for n, d in inputs.items():
        for inp, path in d.items():
            t = time.time()
            try:
                segs = fn(path)
            except Exception as e:
                segs = [{"start": 0, "end": 0, "text": f"ERROR: {e!r}"}]
            save(n, model, inp, segs, time.time() - t)

# ---- v2-1) Whisper large-v3 WITHOUT VAD (v1 used vad_filter=True, which dropped almost all sung audio on the mix)
from faster_whisper import WhisperModel
fw = WhisperModel("large-v3", device="cuda", compute_type="float16")
def fw_run(path):
    segs, _ = fw.transcribe(path, language="ko", vad_filter=False, condition_on_previous_text=False, beam_size=5)
    return [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text} for s in segs]
run_all("whisper-large-v3-novad", fw_run)
del fw; torch.cuda.empty_cache()

# ---- v2-2) Korean fine-tuned Whisper turbo: v1 failed (generation config lacks timestamp tokens) -> borrow base turbo config
from transformers import pipeline, GenerationConfig
asr = pipeline("automatic-speech-recognition", model="ghost613/whisper-large-v3-turbo-korean",
               torch_dtype=torch.float16, device="cuda:0")
asr.model.generation_config = GenerationConfig.from_pretrained("openai/whisper-large-v3-turbo")
def hf_run(path):
    r = asr(path, chunk_length_s=30, batch_size=8, return_timestamps=True,
            generate_kwargs={"language": "ko", "task": "transcribe"})
    return [{"start": c["timestamp"][0], "end": c["timestamp"][1] if c["timestamp"][1] is not None else c["timestamp"][0], "text": c["text"]} for c in r["chunks"]]
run_all("whisper-turbo-ko-ghost613", hf_run)

sh(f"ls -la {OUT}")
