# Usage: python analyze.py <audio> [--stems] [--device mps|cpu] [--segments seg.json]
# BPM (Beat This!) -> sections (SongFormer) -> per-section key (Essentia krumhansl + madmom CNN) + chorus OTI.
# Writes results/<name>.json next to scripts/.
import argparse, json, os, sys, time
from collections import Counter
from pathlib import Path
import numpy as np, librosa

KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
ENH = {"Db": "C#", "D#": "Eb", "Gb": "F#", "G#": "Ab", "A#": "Bb"}
SR = 44100

ap = argparse.ArgumentParser()
ap.add_argument("audio"); ap.add_argument("--stems", action="store_true"); ap.add_argument("--device", default="mps")
ap.add_argument("--segments", help="SongFormer output JSON (skip running SongFormer; it needs ~13GB RAM for a 6-min song)")
args = ap.parse_args()
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
name = Path(args.audio).stem
timing = {}
def tick(k, t0): timing[k] = round(time.time() - t0, 1)

# ---- BPM / beats
t0 = time.time()
from beat_this.inference import File2Beats
beats, downs = File2Beats(checkpoint_path="final0", device=args.device, dbn=False)(args.audio)
tick("beat_this", t0)
ibi = np.diff(beats)
T = 60 / np.median(ibi)
per_bar = [int(((beats >= a) & (beats < b)).sum()) for a, b in zip(downs[:-1], downs[1:])]
meter = Counter(per_bar).most_common(1)[0][0] if per_bar else None

def bpm_in(a, b):
    d = np.diff(beats[(beats >= a) & (beats < b)])
    return round(60 / np.median(d), 1) if len(d) > 3 else None

# ---- sections
t0 = time.time()
if args.segments:
    segments = [s for s in json.load(open(args.segments)) if s["end"] - s["start"] > 0.5]
else:
  from huggingface_hub import snapshot_download
  from transformers import AutoModel
  d = snapshot_download("ASLP-lab/SongFormer", ignore_patterns=["SongFormer.pt", "SongFormer.safetensors"])
  sys.path.append(d); os.environ["SONGFORMER_LOCAL_DIR"] = d
  sf_model = AutoModel.from_pretrained(d, trust_remote_code=True, low_cpu_mem_usage=False).to(args.device).eval()
  segments = [s for s in sf_model(args.audio) if s["end"] - s["start"] > 0.5]
tick("songformer", t0)

# ---- audio for key (full mix, or bass+other stems)
y, _ = librosa.load(args.audio, sr=SR, mono=True)
if args.stems:
    t0 = time.time()
    from demucs.api import Separator
    sep = Separator(model="htdemucs", device=args.device if args.device != "mps" else "cpu")
    _, stems = sep.separate_audio_file(args.audio)
    harm = (stems["bass"] + stems["other"]).mean(0).numpy()
    y = librosa.resample(harm, orig_sr=sep.samplerate, target_sr=SR) if sep.samplerate != SR else harm
    tick("demucs", t0)
tuning = float(librosa.estimate_tuning(y=y, sr=SR))

t0 = time.time()
import essentia.standard as es
from madmom.audio.signal import Signal
from madmom.features.key import CNNKeyRecognitionProcessor, key_prediction_to_label
ess = es.KeyExtractor(profileType="krumhansl", hpcpSize=36, sampleRate=SR)
cnn = CNNKeyRecognitionProcessor()

def norm(k):  # "Ab major" style
    t, m = k.split()[:2]
    return f"{ENH.get(t, t)} {m}"

rows = []
for s in segments:
    a, b = int(s["start"] * SR), int(s["end"] * SR)
    seg = y[a:b].astype(np.float32)
    row = {"label": s["label"], "start": round(s["start"], 1), "end": round(s["end"], 1), "bpm": bpm_in(s["start"], s["end"])}
    if len(seg) > 6 * SR:
        k, sc, strength = ess(seg)
        row["key_essentia"] = norm(f"{k} {sc}"); row["strength"] = round(float(strength), 2)
        row["key_cnn"] = norm(key_prediction_to_label(cnn(Signal(seg, sample_rate=SR))))
        row["chroma"] = librosa.feature.chroma_cqt(y=seg, sr=SR, tuning=tuning).mean(1)
    rows.append(row)
tick("key", t0)

# ---- OTI: each later chorus vs first chorus (semitone shift, -5..+6)
choruses = [r for r in rows if r["label"] == "chorus" and "chroma" in r]
for r in choruses[1:]:
    ref = choruses[0]["chroma"]
    corr = [np.dot(ref, np.roll(r["chroma"], -k)) for k in range(12)]
    k = int(np.argmax(corr)); r["oti_vs_first_chorus"] = k if k <= 6 else k - 12
for r in rows: r.pop("chroma", None)

song_key = Counter(r["key_essentia"] for r in rows if "key_essentia" in r).most_common(1)[0][0]
out = {
    "file": Path(args.audio).name, "stems": args.stems, "device": args.device, "tuning_offset": round(tuning, 2),
    "bpm": {"value": round(T, 1), "alternates": [round(T / 2, 1), round(T * 2, 1)],
            "meter_beats_per_bar": meter, "ibi_cv": round(float(ibi.std() / ibi.mean()), 3)},
    "key": {"song_key_essentia_majority": song_key},
    "sections": rows, "timing_s": timing,
}
res = Path(__file__).resolve().parent.parent / "results" / f"{name}{'.stems' if args.stems else ''}.json"
res.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(json.dumps(out, ensure_ascii=False, indent=1))
