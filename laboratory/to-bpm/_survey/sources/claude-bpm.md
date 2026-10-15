# BPM estimation for worship/CCM audio — research report (2026-09-28)

> Source: Claude research subagent (web search/fetch). Preserved verbatim.

## 1. Method families

| Family | Tools | Notes |
|---|---|---|
| Onset-strength + autocorrelation/tempogram | `librosa.feature.tempo`, `librosa.beat.beat_track` | Pure DSP, ISC license, fast. Uses a log-normal prior centred on 120 BPM (`start_bpm`) → biases slow ballads toward double tempo. Weakest on non-percussive audio. (Parameter details from memory; librosa docs URL 404'd during check.) |
| RNN/TCN activation + DBN | madmom `RNNBeatProcessor` + `DBNBeatTrackingProcessor`, `DBNDownBeatTrackingProcessor` | Classic SOTA; DBN enforces steady tempo/meter → good continuity metrics. |
| Deep, no DBN | **Beat This!** (Foscarin et al., ISMIR 2024) | Conv + transformer, ~20M params (also 2M "small"). Beats + downbeats. SOTA beat F1 without DBN. https://arxiv.org/html/2407.21658 |
| | **All-In-One** (Taejun Kim, WASPAA 2023) | Beats, downbeats, BPM **and functional segments** (intro/verse/chorus/bridge/outro) in one ~300k-param model trained on Harmonix — also covers the "structure" part of your feature. https://github.com/mir-aidj/all-in-one, https://arxiv.org/html/2307.16425 |
| | **BeatNet** (ISMIR 2021; BeatNet+ TISMIR) | CRNN + particle filter; online & offline; joint beat/downbeat/tempo/meter. Depends on madmom. https://github.com/mjhydri/BeatNet |
| Direct global-tempo CNN | essentia `TempoCNN` (Schreiber) | Outputs `globalTempo`, `localTempo`, probabilities; majority voting assumes constant tempo. https://essentia.upf.edu/reference/std_TempoCNN.html |
| 2025-26 research | Masked-diffusion beat tracking (Foscarin, Korzeniowski, Vogl, ISMIR 2026) — reduces erratic outputs; no benchmark numbers/code link in abstract. https://arxiv.org/abs/2608.04624 | Beat This! remains the practical open SOTA. |

## 2. Benchmark numbers

**Beat F1 (mir_eval)**, Beat This! vs Hung et al. transformer (https://arxiv.org/html/2407.21658):
- GTZAN: **89.1** vs 88.7 (downbeat F1 78.3 vs 75.6)
- Ballroom: 97.5 vs 96.2
- Hainsworth: 91.9 vs 87.7
- SMC (expressive, hard): 62.7 vs 60.5
- Caveat: Beat This! has **lower continuity (CMLt)** than DBN systems (79.8 vs 81.2 on GTZAN).

**Global tempo Accuracy1 / Accuracy2** (via Sun et al. 2021, https://arxiv.org/pdf/2109.01607):
- GTZAN: Böck 69.7 / 95.0, Schreiber CNN 69.4 / 92.6
- Ballroom: Böck 84.0 / 98.7, Schreiber 92.0 / 98.4
- Takeaway: Accuracy2 (tolerates ×2, ×3, ×½, ×⅓) ≈ 95%, Accuracy1 only ~70% on diverse genres → **octave error is the dominant failure mode, not tempo detection itself.**

**Harmonix (All-In-One):** paper claims SOTA on all four tasks; exact numbers not extracted.

## 3. Pitfalls & remedies

- **Octave (half/double) errors** — the main risk for slow worship ballads (60–75 BPM). madmom DBN defaults **min_bpm=55**; it failed on 21% of SMC tracks by forcing double tempo (https://arxiv.org/abs/2605.12287). Same paper: models give "confident-but-wrong" activations; recommends multi-hypothesis tempo estimation.
  - Remedy: set `min_bpm/max_bpm` explicitly (e.g., 50–180); keep top-2 tempo hypotheses (T and T/2 or 2T) and choose using a worship-genre prior + downbeat/meter consistency; optionally let users toggle ×2/÷2 in UI.
- **6/8 and 12/8** (common in worship, e.g., "How Great Is Our God"-style feels): dotted-quarter vs eighth-note pulse ambiguity. Skip That Beat shows underrepresented meters hurt models (https://arxiv.org/pdf/2502.12972).
  - Remedy: estimate meter from downbeats (beats per bar), report BPM at the conventional chart pulse (for compound meter report dotted-quarter to match CCLI/SongSelect conventions — assumption).
- **Live rubato / drift**: report **median of inter-beat intervals** rather than a single autocorrelation peak; also keep a local tempo curve and flag songs where IQR > ~3 BPM.
- **Drumless intros** (pad/piano + vocal): activations weak, SMC-like failures. Remedy: compute global BPM from beats in high-confidence/full-band segments (All-In-One segments help), ignore intro/outro.

## 4. Practical checks

- **madmom**: code BSD, but **models/data CC BY-NC-SA 4.0 (non-commercial)** — commercial use needs a license from JKU (Gerhard Widmer). https://github.com/CPJKU/madmom. Last PyPI release **0.16.1 (Nov 2018)**, sdist only, no wheels (https://pypi.org/project/madmom/); breaks on Python ≥3.10 / NumPy deprecations. Workaround: `pip install git+https://github.com/CPJKU/madmom` (0.17.dev) (https://github.com/CPJKU/beat_this/issues/9). Some 2025 activity (PR #542 numpy types).
- **Beat This!**: **MIT license for code and weights**, `pip install beat-this`, PyTorch ≥2.0, CPU or GPU fallback. https://github.com/CPJKU/beat_this. Optional `--dbn` pulls madmom (inherits its problems).
- **All-In-One**: MIT code; depends on madmom (git), NATTEN (painful build; Windows needs source build), demucs, PyTorch. Demucs source separation makes it the heaviest on CPU (tens of seconds per song — estimate, not verified). madmom dependency likely brings NC model license concerns.
- **BeatNet**: CC BY 4.0 but requires madmom.
- **essentia**: AGPL library; TempoCNN models are **CC BY-NC-SA 4.0** (https://essentia.upf.edu/models.html) — not commercial without proprietary license.
- **librosa**: ISC, pip wheels, maintained — safe baseline/fallback.

## 5. Recommended pipeline

1. Decode with ffmpeg → 22.05/44.1 kHz mono.
2. **Beat This!** (MIT, pip, SOTA F1) → beats + downbeats. Use plain peak-picking; **avoid `--dbn`** to drop madmom/license.
3. **Tempo** = 60 / median(IBI) over the stable core region (e.g., middle 60% or chorus/verse segments); also store local tempo curve + stability flag for live recordings.
4. **Meter** = mode of beats-per-bar from downbeats; for 6/8/12/8 report dotted-quarter BPM.
5. **Octave resolution**: candidates {T/2, T, 2T}; score with a genre prior (e.g., log-normal around ~75 BPM spanning 55–160 for worship) + librosa tempogram energy as cross-check; return alternate BPM if close.
6. For structure (if licensing permits): All-In-One gives segments + a second BPM opinion; otherwise segment separately and reuse Beat This! downbeats to snap boundaries to bars.
7. Validate on 30–50 hand-labelled worship tracks (half studio, half live): measure Accuracy1/Accuracy2 and beat F1 with `mir_eval`; tune the prior on that set.

**Key uncertainties:** no public worship/CCM benchmark — the local validation set in step 7 is essential. CPU runtime for Beat This! on a full song not measured (expect a few seconds/song for small model; benchmark it).
