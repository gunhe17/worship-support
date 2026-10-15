# Smoke test: synthetic 72 BPM song, G major 40s -> Ab major 20s. Checks CPU runtime + outputs.
import time, numpy as np, soundfile as sf

SR, BPM = 44100, 72
beat = 60 / BPM

def tone(freqs, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t * 20) * np.exp(-t * 1.5)
    return sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) for f in freqs) * env

def chord(root_midi, minor=False):
    third = 3 if minor else 4
    notes = [root_midi - 12, root_midi, root_midi + third, root_midi + 7]
    return [440 * 2 ** ((n - 69) / 12) for n in notes]

def section(tonic, secs):
    # I - V - vi - IV, one chord per bar (4 beats)
    prog = [(0, False), (7, False), (9, True), (5, False)]
    bar = 4 * beat
    out = []
    for i in range(int(secs / bar)):
        off, mi = prog[i % 4]
        out.append(tone(chord(tonic + off, mi), bar))
    return np.concatenate(out)

music = np.concatenate([section(55, 40), section(56, 20)])  # G3 -> Ab3
kick = np.zeros_like(music)
k = np.sin(2 * np.pi * 60 * np.arange(int(SR * 0.1)) / SR) * np.exp(-np.arange(int(SR * 0.1)) / SR * 40)
for n in range(int(len(music) / SR / beat)):
    s = int(n * beat * SR)
    kick[s:s + len(k)] += k[: len(kick) - s] * (1.5 if n % 4 == 0 else 0.8)
y = 0.2 * music / np.abs(music).max() + 0.5 * kick
sf.write("synth.wav", y.astype(np.float32), SR)
split = int(len(section(55, 40)))
sf.write("synth_a.wav", y[:split].astype(np.float32), SR)
sf.write("synth_b.wav", y[split:].astype(np.float32), SR)
print(f"audio: {len(y)/SR:.1f}s, truth: {BPM} BPM, G major -> Ab major at {split/SR:.1f}s\n")

def timed(name, fn):
    t = time.time(); r = fn(); print(f"[{name}] {time.time()-t:.1f}s -> {r}")

import essentia.standard as es
def ess_key(path):
    a = es.MonoLoader(filename=path)()
    return es.KeyExtractor(profileType="krumhansl", hpcpSize=36)(a)
for part in ("synth_a.wav", "synth_b.wav"):
    timed(f"essentia krumhansl {part}", lambda p=part: ess_key(p)[:2])

from madmom.features.key import CNNKeyRecognitionProcessor, key_prediction_to_label
proc = CNNKeyRecognitionProcessor()
for part in ("synth_a.wav", "synth_b.wav"):
    timed(f"madmom CNN key {part}", lambda p=part: key_prediction_to_label(proc(p)))

import librosa
def lib_tempo():
    a, sr = librosa.load("synth.wav")
    return float(librosa.feature.tempo(y=a, sr=sr)[0])
timed("librosa tempo", lib_tempo)

from beat_this.inference import File2Beats
f2b = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)
def bt():
    beats, downs = f2b("synth.wav")
    return f"{60/np.median(np.diff(beats)):.1f} BPM, {len(beats)} beats, {len(downs)} downbeats"
timed("Beat This! cpu", bt)
