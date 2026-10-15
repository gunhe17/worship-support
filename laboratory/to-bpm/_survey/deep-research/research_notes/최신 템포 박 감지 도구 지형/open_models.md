# Latest open tempo / beat / downbeat models and tools (2024–2026), beyond what the project already covers

Scope note: survey.md, survey-methods-2026-10.md and sources/claude-bpm.md already cover Beat This!, madmom RNN+DBN, All-In-One, BeatNet/BeatNet+/BEAST, TempoCNN, RhythmExtractor2013/Percival, DeepRhythm, Phasefinder, librosa, aubio/BTrack, and they mention BeatFM, "object detection" (2510.14391) and masked-diffusion (2608.04624) in one line each. These notes add detail and new items, and correct one existing citation. Research date: 2026-10-14. Budget: about 18 web calls. Anything not verified is listed under Gaps.

## Q1. New beat/downbeat/tempo models 2024–2026: what they output, whether code/weights exist, accuracy, how they compare with Beat This!

### Takeaway
No public model released in 2024–2026 has clearly displaced Beat This! as the open, MIT-licensed, batch-runnable state of the art for offline beat and downbeat tracking.

The newer academic work falls into three groups:
- **Masked diffusion (ISMIR 2026) and AlignBeat (ICASSP 2027 submission):** both target the continuity and erratic-output weakness of Beat This!. Neither paper links code or weights.
- **Foundation-model fine-tunes (BeatFM):** a "do not cite" draft with no weights.
- **Failure analyses (SMC Blind Spot):** these confirm that slow, expressive music causes octave errors.

The genuinely new practical artefacts are community ports of Beat This! (ONNX, GGUF, MLX, Rust) and SongFormer, an open structure-analysis model with no beat output.

### Cited Findings

**Masked diffusion beat tracking (ISMIR 2026)**
- Authors and date: Francesco Foscarin, Filip Korzeniowski, Richard Vogl, "Masked diffusion enables coherent beat tracking", arXiv 2608.04624, submitted 5 Aug 2026, accepted at ISMIR 2026 — [arXiv](https://arxiv.org/abs/2608.04624)
- Problem addressed: neural beat trackers produce invalid outputs, such as consecutive downbeats and erratic tempo changes. The authors attribute this to poor modelling of multiple plausible beat grids — [arXiv](https://arxiv.org/abs/2608.04624)
- Method: masked diffusion with independent masking of beats and downbeats, a balanced masking scheduler at inference, and peak-picking across inference steps. The authors claim it "reduces erratic behaviours and improves beat-tracking performance" — [arXiv](https://arxiv.org/abs/2608.04624)
- Code and numbers: the abstract page links no code or weights repository and gives no benchmark numbers. The paper text is CC BY 4.0 — [arXiv](https://arxiv.org/abs/2608.04624)
- Lineage: the acknowledgments thank Jan Schlüter and cite Beat This! as reference [1], so this is a direct Beat This! follow-up from the same first author — [arXiv PDF](https://arxiv.org/pdf/2608.04624)

**AlignBeat / "Beat Tracking as Object Detection" (arXiv 2510.14391)**
- Title conflict: the arXiv abstract page currently titles 2510.14391 "AlignBeat: A Latent Variable Model for Multi-Class Beat Tracking from Partially Labeled Data" (Jaehoon Ahn, Tae Gum Hwang, Moon-Ryul Jung), submitted to ICASSP 2027 — [arXiv abs](https://arxiv.org/abs/2510.14391)
- The v2 HTML of the same ID is titled "Beat Tracking as Object Detection" and introduces BeatFCOS — [arXiv v2 HTML](https://arxiv.org/html/2510.14391v2)
- So the ID was retitled and reframed between versions. The project survey's label "Beat tracking as object detection" refers to the old version.
- AlignBeat claims, without post-processing and using 8-fold cross-validation over 18 datasets:
  - downbeat CMLt +3.6 points over Beat This!
  - beat CMLt +4.6 points on datasets with beat-only labels
  - beat and downbeat F-measures change by less than 1 point
  - no project code link — [arXiv abs](https://arxiv.org/abs/2510.14391)
- The old BeatFCOS v2 results are weak. On a WaveBeat backbone it reaches GTZAN beat F1 0.808 and SMC 0.400, versus Spectral TCN 0.885/0.544 and Hung et al. 0.887/0.605. It did not compare against Beat This! numerically and did not evaluate Harmonix. The only repositories linked are reference files (github.com/zaiisao/beatfcos-reference-files) and WaveBeat — [arXiv v2 HTML](https://arxiv.org/html/2510.14391v2)

**The SMC Blind Spot (2026 failure analysis)**
- Same group as AlignBeat (Ahn, Hwang, Jung), arXiv 2605.12287, 12 May 2026, a technical report for ISMIR 2026 — [arXiv](https://arxiv.org/abs/2605.12287)
- Three failure modes on SMC: octave errors, continuity errors, and complete failure (all metrics below 0.3) — [arXiv](https://arxiv.org/abs/2605.12287)
- The models produce "confident-but-wrong" activations — [arXiv](https://arxiv.org/abs/2605.12287)
- The DBN default `min_bpm=55` blocks the correct tempo on 21% of SMC tracks, forcing double tempo — [arXiv](https://arxiv.org/abs/2605.12287)
- Recommendations: more diverse training data and multi-hypothesis tempo estimation. No code — [arXiv](https://arxiv.org/abs/2605.12287)

**BeatFM (2025)**
- Ganghui Ru et al., arXiv 2508.09790 (v1 13 Aug 2025, v2 9 Sep 2025). It fine-tunes a pre-trained music foundation model (MERT/MusicFM family) for beat and downbeat tracking — [arXiv](https://arxiv.org/abs/2508.09790)
- Status: the comments field says "Early draft for discussion only / Do not cite", with a peer-reviewed version in preparation. No code or weights. The abstract claims SOTA on "multiple benchmark datasets" but gives no numbers — [arXiv](https://arxiv.org/abs/2508.09790)

**Foundation-model probes**
- A multi-class-token transformer for multitask self-supervised MIR (arXiv 2507.12996) reports that MERT-v1-95M beats it on beat tracking. This shows sequence-level SSL features remain competitive for beat probes — [arXiv](https://arxiv.org/html/2507.12996v1)
- MuQ (arXiv 2501.01108) claims to beat MERT and MusicFM on downstream tasks with 0.9K hours of pre-training. I found no beat or tempo-specific result for it — [arXiv](https://arxiv.org/html/2501.01108v1)

**Self-supervised tempo / beat learning**
- Gagneré, Essid and Peeters, "Controlling Contrastive Self-Supervised Learning with Knowledge-Driven Multiple Hypothesis: Application to Beat Tracking", arXiv 2510.25560 (Oct 2025) — [arXiv](https://arxiv.org/pdf/2510.25560)
- Earlier contrastive few-shot beat tracking, arXiv 2411.04152 (2024) — [arXiv](https://arxiv.org/pdf/2411.04152)
- Henkel et al., "Tempo estimation as fully self-supervised binary classification", arXiv 2401.08891 (2024) — [arXiv](https://arxiv.org/pdf/2401.08891)
- None of these surfaced public production weights in my searches.

**dPLP (ISMIR 2025)**
- Chiu, Strahl and Müller, "dPLP: A Differentiable Version of Predominant Local Pulse Estimation", ISMIR 2025 poster P2-10 — [project page](https://www.audiolabs-erlangen.de/resources/MIR/2025_ChiuSM_dPLP_ISMIR), [ISMIR program](https://ismir2025program.ismir.net/poster_135.html)
- Method: it replaces PLP's max-kernel selection with a softmax weighting, so PLP can be used as a layer or a loss inside deep beat trackers. It is a building block, not a ready tempo tool — [project page](https://www.audiolabs-erlangen.de/resources/MIR/2025_ChiuSM_dPLP_ISMIR)
- Related: the same lab's real-time, zero-latency PLP beat tracker (TISMIR 2024) — [AudioLabs](https://audiolabs-erlangen.com/resources/MIR/2024-TISMIR-RealTimePLP)

**Osu2MIR (ISMIR 2025 late-breaking/demo)**
- Mines osu! rhythm-game beatmaps for beat and downbeat annotations. The pipeline and the osu2beat2025 subset are released at github.com/ziyunliu4444/osu2mir. It is a data source, not a model — [arXiv 2509.12667](https://arxiv.org/html/2509.12667v1)

**SongFormer (ASLP-lab, 2025)**
- Music structure analysis model (boundaries and functional labels). It claims SOTA strict boundary HR.5F on SongFormBench — [arXiv 2510.02797](https://arxiv.org/html/2510.02797v2)
- Releases: inference and checkpoints 30 Sep 2025, training code 3 Oct 2025 — [GitHub](https://github.com/aslp-lab/songformer)
- Hosted on the Hugging Face model hub and as a Space, with the SongFormDB and SongFormBench datasets — [HF model](https://huggingface.co/ASLP-lab/SongFormer)
- I found no evidence of beat, downbeat or tempo outputs, so it can succeed All-In-One only for the structure part.

**Beat-tracking work in other domains**
- Beat and downbeat tracking in performance MIDI with an end-to-end transformer, arXiv 2507.00466 (2025). Its input is MIDI, so it does not apply to audio — [arXiv](https://arxiv.org/abs/2507.00466)

**Real-time / streaming**
- BEAST (ICASSP 2024; code at github.com/WildHoneyPie/BEAST) remains the reference open streaming transformer — [GitHub](https://github.com/WildHoneyPie/BEAST), [arXiv](https://arxiv.org/abs/2312.17156)
- A 2026-focused search surfaced no newer open streaming beat or downbeat tracker — [search context: arXiv 2605.12287 cites BEAST](https://arxiv.org/pdf/2605.12287)

**Community ports of Beat This! (2025–2026, all unofficial, inheriting MIT weights)**
- `cstr/beat-this-GGUF`: f16 41 MB default build plus f32. The model card says it was validated stage by stage against PyTorch and needs no madmom — [HF](https://huggingface.co/cstr/beat-this-GGUF)
- `musetric/beat-this-onnx`: ONNX for onnxruntime-web/WebGPU. Mel features are computed on the host and no DBN is included — [HF](https://huggingface.co/musetric/beat-this-onnx)
- `ashudesai/songbird-models`: ONNX final0–2 (about 80 MB each) and small0–2 (about 10 MB each). Input is a mel spectrogram of shape (1, frames, 128) — [HF](https://huggingface.co/ashudesai/songbird-models)
- `schism-audio/beat-this-mlx` for Apple Silicon — [HF](https://huggingface.co/schism-audio/beat-this-mlx)
- Rust crate `beat-this` v1.0.0 (rten or ONNX Runtime backends) — [docs.rs](https://docs.rs/crate/beat-this/1.0.0)

**Official Beat This! repository status**
- Checkpoints: final0–2, small0–2, single_final0–2, fold0–7 and hung0–2, plus ablation models.
- Batch CLI: `beat_this path/*.mp3 dir/ -o outdir`, with `--gpu`/`--gpu=-1`, `--float16`, and `--touch-first --skip-existing` for multi-process sharding.
- License: MIT for code and weights. Some training data is under restrictive licenses.
- No GitHub releases are listed, and there is no official ONNX or streaming support — [GitHub](https://github.com/CPJKU/beat_this)

### Inferences
- **Recommendation for Kaggle batch work:** Beat This! stays the anchor (MIT, pip, multi-file CLI with GPU float16 and resumable sharding). None of the 2025–2026 papers ships weights that can be dropped in.
- **Masked diffusion:** if CPJKU or Sony release code, it is the first thing worth testing. It targets exactly the project's observed issues (2-beat bars, segment splits, erratic tempo), and the authors have released Beat This! weights under MIT before. Its release is not confirmed.
- **AlignBeat:** a gain of +3.6 to +4.6 CMLt with unchanged F1 means it improves continuity, which is the known Beat This! weakness. That matters more for a BPM and meter product than F1 does. Its code is not public.
- **Correction for the project survey:** survey.md cites arXiv 2510.14391 as "Beat tracking as object detection, roughly equal performance". The current version is AlignBeat, with a different claim (better continuity than Beat This!). The citation should be updated.
- **SongFormer** could replace All-In-One's segment head without NATTEN or madmom, but beats would still need to come from Beat This!.

### Gaps
- Masked-diffusion numbers per dataset and code release status: the abstract page gives neither. I did not read the full PDF results tables.
- AlignBeat per-dataset tables: they were not extracted from the paper body.
- I found no ICASSP 2025/2026 or WASPAA 2025 beat or tempo paper with released code. The searches were limited and the programmes were not browsed exhaustively.
- I found no 2024–2026 "Allin1 successor" that outputs beats, downbeats and structure together with public weights.
- I could not confirm the license of SongFormer weights.
- Tempo-invariant or new global-tempo CNNs (successors to TempoCNN or DeepRhythm) from 2024–2026 with weights: none found.

## Q2. Library and maintenance status (madmom, librosa, Essentia, HF pipelines, QM/Vamp, aubio)

### Takeaway
madmom on PyPI is still stuck at 0.16.1 (2018); in practice people install the git 0.17.dev version or use ONNX re-packages. librosa 0.11.0 is the current release, with tempo now under `librosa.feature.tempo`. I could not verify any Essentia 2.1 tempo-model update, Hugging Face transformers beat pipeline, or Vamp/sonic-annotator changes within this budget.

### Cited Findings
- **madmom:**
  - piwheels lists madmom only up to 0.16.1 (2018-11-14), with builds for Python 3.9, 3.11 and 3.13. The page was last updated 2025-09-08 — [piwheels](https://www.piwheels.org/project/madmom)
  - A `madmom-onnx` package on PyPI carries "Version 0.17.dev0" release notes, so ONNX-based re-packaging of madmom models exists — [PyPI madmom-onnx](https://pypi.org/project/madmom-onnx/)
  - Downstream packages note that "madmom versions < 0.17 error with python 3.10" and pin a git commit — [PyPI nendo-plugin-loopify](https://pypi.org/project/nendo-plugin-loopify/0.1.0)
- **librosa:**
  - 0.11.0 is the latest documented release, and its `beat_track` docs still describe the onset-strength, tempo and DP pipeline with `start_bpm` and `tightness` — [librosa 0.11 beat_track](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html)
  - `librosa.beat.tempo` moved to `librosa.feature.tempo` in 0.10.0 and is slated for removal in 1.0 — [librosa beat source](https://librosa.org/doc/main/_modules/librosa/beat.html), [changelog](https://librosa.org/doc/main/changelog.html)
- **QM Tempo Tracker (Vamp):** still used as the "CD1" baseline in MIREX 2025. It reaches GTZAN F1 81.19 and SMC 33.66, far below Beat This! — [MIREX 2025](https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results)

### Inferences
- **madmom on Kaggle (Python 3.10/3.11):** the git install route stays the practical one. madmom-onnx may avoid Cython build issues, but it was not verified for DBN processors.
- **Vamp plugins:** QM Vamp plus sonic-annotator is a valid, cheap batch baseline, but MIREX shows it is about 8 F1 points below Beat This! on GTZAN and collapses on SMC. It is not worth adding beyond a sanity baseline.

### Gaps
- No verified information found on:
  - Essentia 2.1 releases or new tempo models in essentia-tensorflow
  - torchaudio or nnAudio beat utilities
  - a Hugging Face transformers beat-tracking pipeline
  - BeatNet+ public code
  - Mixxx analyzer changes
  - aubio releases
  - sonic-annotator or BeatRoot status
- madmom on Python 3.12 specifically: not confirmed either way.

## Q3. Public leaderboards (MIREX 2024–2026, Papers-with-Code successors)

### Takeaway
MIREX 2025 Audio Beat Tracking is the only current public comparison I found. Beat This! (as the baseline) is competitive with all submissions, and none of those submissions has public code. MIREX bans GTZAN training from 2026 on. I found no 2026 results page and no 2025 tempo-estimation task.

### Cited Findings
MIREX 2025 beat tracking, F1 / CMLt / AMLt — [MIREX 2025](https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results)

| System | Code | GTZAN | SMC | YAMAHA J-pop |
|---|---|---|---|---|
| BeatU (Zhao, Nishiyama, Sumi, Fujishima, Maezawa – Yamaha) | none | 84.93 / 75.26 / 84.27 | 53.14 / 41.16 / 47.44 | 96.58 / 94.46 / 97.05 |
| KG-ApolloBeats (Xiao, Cai, Chen) | none | 92.53* / 88.49 / 92.77 | 74.15* | — |
| KG-ApolloBeats 2 (no GTZAN training) | none | 88.21 / 81.05 / 92.18 | 58.55 / 50.80 / 61.45 | 95.87 / 92.00 / 94.49 |
| Beat This! baseline | public | 89.02 / 79.64 / 90.01 | 71.81* / 69.89 / 72.30 | 94.00 / 86.64 / 89.57 |
| QM Tempo Tracker (CD1) | — | 81.19 / 66.94 / 86.69 | 33.66 / 13.12 / 29.48 | 77.38 / 58.71 / 85.29 |

\* trained on that dataset.

- Other MIREX 2025 notes:
  - Evaluation moved to mir_eval.
  - "Starting from next year, training on GTZAN will be disallowed."
  - The YAMAHA sets are private — [MIREX 2025](https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results)
- The `2026:Audio_Beat_Tracking_Results` wiki page returned HTTP 404 on 2026-10-14 — [MIREX 2026 URL](https://music-ir.org/mirex/wiki/2026:Audio_Beat_Tracking_Results)
- Tempo-estimation results: the latest found are the older MIREX archives (2017/2018) — [MIREX 2018 ATE Giants](https://nema.lis.illinois.edu/nema_out/mirex2018/results/ate/giants/summary.html)

### Inferences
- On private J-pop data (closest to studio pop/CCM), the closed systems BeatU and ApolloBeats 2 beat Beat This! on continuity: CMLt 92–94 versus 86.6. This shows continuity headroom remains on pop material, but there are no open weights to exploit.
- No current public tempo-estimation leaderboard exists. Global-BPM claims for new tools must be checked locally (GTZAN plus the worship set), as the project already does.

### Gaps
- MIREX 2026 results: not yet posted, or posted at a different URL.
- A Papers-with-Code successor leaderboard for beat tracking: not found.

## Q4. Which handle variable tempo, rubato and slow ballads / octave ambiguity best?

### Takeaway
Slow, expressive, non-percussive material is still unsolved.
- On SMC, the best open fair number remains Beat This! at about 62.7 F1 (paper 8-fold). MIREX's 71.81 includes SMC training.
- The newest analyses blame octave errors and DBN tempo priors.
- The 2025–2026 proposals aimed at coherent grids (masked diffusion, AlignBeat continuity, multi-hypothesis tempo) are the relevant direction, but none has public weights.

### Cited Findings
- DBN `min_bpm=55` forces double tempo on 21% of SMC tracks, and models give confident-but-wrong activations. The paper recommends multi-hypothesis tempo estimation — [arXiv 2605.12287](https://arxiv.org/abs/2605.12287)
- Masked diffusion explicitly targets "erratic tempo changes" and "consecutive downbeats" by modelling multiple plausible beat grids — [arXiv 2608.04624](https://arxiv.org/abs/2608.04624)
- AlignBeat improves downbeat CMLt by +3.6 over Beat This! without post-processing — [arXiv 2510.14391](https://arxiv.org/abs/2510.14391)
- On SMC, the QM Tempo Tracker scores CMLt 13.12, BeatU 41.16, and Beat This! (SMC-trained) 69.89. Classic DSP and some commercial-lab systems collapse on expressive material — [MIREX 2025](https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results)
- dPLP makes local-pulse (tempo-curve-like) estimation differentiable. This suits locally varying tempo, but it is a research layer — [AudioLabs dPLP](https://www.audiolabs-erlangen.de/resources/MIR/2025_ChiuSM_dPLP_ISMIR)

### Inferences
- For worship ballads, the existing project pipeline remains the best practical recipe: Beat This! without DBN, local tempo curves, candidates {T/2, T, 2T} with a genre prior, and a half-time flag.
- If madmom DBN is used for continuity, widen `min_bpm` below 55, for example 40.

### Gaps
- No public benchmark specific to rubato or worship music.
- No 2024–2026 open model reports per-tempo-range (slow-ballad) accuracy.
