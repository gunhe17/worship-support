
import glob, json, os, time
SRC, W, OUT = "/kaggle/input/datasets/gunhe17/worship-songform-pool", "/kaggle/working", "/kaggle/working/out"
SONGS = json.load(open(f"{SRC}/songs.json"))
PAD = 1.5
def tlog(k, v):
    p = f"{OUT}/timing.json"; d = json.load(open(p)) if os.path.exists(p) else {}
    d[k] = round(v, 1); json.dump(d, open(p, "w"), indent=1)

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
