
import glob, json, os, time
SRC, W, OUT = "/kaggle/input/datasets/gunhe17/worship-songform-pool", "/kaggle/working", "/kaggle/working/out"
SONGS = json.load(open(f"{SRC}/songs.json"))
PAD = 1.5
def tlog(k, v):
    p = f"{OUT}/timing.json"; d = json.load(open(p)) if os.path.exists(p) else {}
    d[k] = round(v, 1); json.dump(d, open(p, "w"), indent=1)

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
