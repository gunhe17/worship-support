# Song structure (arrangement) extraction for worship/CCM audio — research report (as of 2026-09-28)

> Source: Claude research subagent (web search/fetch). Preserved verbatim.

## 1. Unsupervised: boundaries + clustering
- **Approach**: build a self-similarity / recurrence matrix from chroma or MFCC features (beat-synchronous), detect boundaries with Foote's checkerboard novelty, and cluster the repeated sections.
- **Laplacian segmentation**: McFee & Ellis, "Analyzing Song Structure with Spectral Clustering" (ISMIR 2014). librosa ships a gallery implementation: https://librosa.org/doc/0.11.0/auto_examples/plot_segmentation.html
- **MSAF (Nieto)**: MIT-licensed. Bundles many boundary and labeling algorithms (Foote, spectral clustering and others) and still has CI and open PRs: https://github.com/urinieto/msaf
- **Output**: only A/B/C cluster IDs, not "Verse" or "Chorus". Useful as a fallback or as a repetition prior.
- **Newer embeddings**: a March 2026 paper runs Foote, spectral clustering and CBM on barwise deep embeddings: https://arxiv.org/abs/2603.27218

## 2. Supervised functional labeling
| Model | Labels | Train data | SongFormBench-Harmonix ACC / HR.5F / HR3F |
|---|---|---|---|
| **SongFormer** (ASLP-lab, Oct 2025) | intro, verse, **pre-chorus**, chorus, bridge, inst, outro, silence | SongFormDB (>14k songs, multilingual) + Harmonix etc. | 0.795–0.807 / **0.703** / 0.784 |
| LinkSeg-7Labels | 7 | Harmonix | 0.780 / 0.630 / 0.762 |
| **All-In-One (`allin1`)** (Kim & Nam 2023) | start, end, intro, outro, break, bridge, inst, solo, verse, chorus | Harmonix only (8-fold CV) | 0.740 / 0.596 / 0.730 |
| Gemini 2.5 Pro | free text | n/a | 0.748 / **0.423** / 0.813 |

- **Other SongFormer results**: SongFormBench-CN 0.891 / 0.690 and RWC-Pop 0.814 / 0.651 (ACC / HR.5F). Inference takes 2–4 s per song on one GPU and needs the MuQ and MusicFM SSL backbones.
- **Links**: SongFormer paper https://arxiv.org/html/2510.02797v3 · repo https://github.com/ASLP-lab/SongFormer/ · All-In-One paper https://arxiv.org/abs/2307.16425 · allin1 repo https://github.com/mir-aidj/all-in-one
- **Datasets**: Harmonix Set (about 900 pop songs; annotations only, you must source the audio yourself), SALAMI, RWC-Pop, SongFormDB and SongFormBench (both on Hugging Face).
- **Related work**: Temporal Adaptation of Foundation Models for MSA (July 2025): https://arxiv.org/html/2507.13572
- **Not found**: no clearly newer model with verified results that beats SongFormer.

## 3. Lyrics-based and audio-LLM approaches
- **Why lyrics matter here**: worship songs usually have known lyric sheets with [Verse 1]/[Chorus]/[Bridge]/[Tag] tags. Aligning those sheets to the audio gives *your* label vocabulary and the numbering (Verse 1 vs Verse 2) for free. No audio model provides that numbering.
- **Pipeline**: separate the vocals with Demucs, then force-align the known lyric text using WhisperX (wav2vec2 CTC) or MFA. Use recognition only to decide *which* section is sung when; don't rely on it for the transcript.
- **Caveats on alignment**:
  - Transcribing sung lyrics is much harder than speech. Adapted Whisper-large-v3 still has about 27% WER (Greek ALT): https://arxiv.org/html/2609.11302
  - MFA treats melisma as silence: https://arxiv.org/pdf/2507.06670
  - WhisperX's VAD merges whole verses. Repetitive songs cause mis-anchoring; one report has the first line matched 53 s late: https://github.com/thorwhalen/muvid/issues/101
  - Because of this, match at the *section* level: fuzzy-match text to candidate sections, then run a DP/HMM over the allowed section order. Don't trust word-level timings.
- **Audio LLMs** (Gemini, GPT-4o audio, Qwen2-Audio):
  - Gemini gets a good coarse label order, but its boundaries are about ±2 s off (HR.5F 0.42, per SongFormer).
  - The BASS benchmark (Feb 2026) scores Gemini 2.5 Pro at only 26.5% on music-structure reasoning, and most other models under 15%: https://arxiv.org/html/2602.04085v1
  - Use an LLM only as a label-naming or reconciliation step on top of precise boundaries.

## 4. Pitfalls for worship music
- **Instrumental sections** (intro, turnaround, interlude): the lyric alignment has no anchor there. Use the audio model's `inst`/`intro` labels plus beat or downbeat grid snapping.
- **Repeated choruses with variation** (key lift, half-time, a cappella, "drums in"): SSM clustering may split these into different letters. Merge them by lyric identity.
- **Live vamps, spontaneous worship and the bridge sung 4–8 times**: these break both Harmonix-style priors and lyric-sheet order. Allow unlimited repeats in the DP, and add a "Spontaneous/Vamp" label when there are vocals but no lyric match.
- **Vocabulary mismatch**: allin1 has no pre-chorus, tag or turnaround label. SongFormer has pre-chorus internally but maps it to verse in its evaluation. Map model labels to a worship vocabulary afterwards: tag = short repeat of the chorus tail; turnaround or interlude = short `inst` between vocal sections.
- **Talking over the music**: spoken prayer or scripture over pads confuses ASR and the models.

## 5. Evaluation (mir_eval.segment)
- `detection` gives HR.5F at window 0.5 s and HR3F at window 3 s.
- `deviation` gives the median boundary error.
- `pairwise`, `nce` and `vmeasure` give label agreement at the frame level (0.1 s).
- Add frame-level label accuracy (the "ACC" in the table above) after mapping to a shared vocabulary.
- Docs: https://mir-eval.readthedocs.io/latest/api/segment.html

## 6. License, maintenance and installability
- **allin1**:
  - MIT licensed. The last PyPI release is 1.1.0 (Oct 2023), classifiers go up to Python 3.11, so it is effectively stale: https://pypi.org/project/allin1/
  - It needs NATTEN (a manual install on Linux/Windows, matched to your torch/CUDA build; CPP-backend import errors are a known problem: https://github.com/SHI-Labs/NATTEN/issues/218), plus madmom installed from git and ffmpeg.
  - Speed: 10 songs in 73 s on an RTX 4090. It runs on CPU/macOS, but slowly because of Demucs.
  - The repo recommends converting MP3 to WAV first because of decoder offsets.
- **SongFormer**:
  - Code is CC-BY-4.0. Check the licenses of the MuQ and MusicFM weights before any commercial use.
  - Installed as a git clone plus a conda requirements file, not pip. Checkpoints come from Hugging Face.
  - Needs a GPU for practical speed.
  - Last major update in the repo news: Oct 2025.
- **MSAF and librosa**: both pip-installable and CPU-only. MSAF is MIT; librosa is ISC.
- **WhisperX**: pip-installable (BSD). GPU recommended.

## 7. Recommended pipeline
1. **Preprocess**: decode to WAV at 44.1 kHz. Separate stems with Demucs (the vocals feed ASR; allin1 does this separation internally).
2. **Audio structure**: run SongFormer to get boundaries and functional labels. Use allin1 as a fallback or second opinion, and for its beat/downbeat grid. Snap boundaries to downbeats.
3. **Lyrics anchor** (when a lyric sheet is known):
   - Run WhisperX on the vocal stem.
   - Fuzzy-match each window to the sheet's tagged sections.
   - Run a Viterbi/DP over the segments (states = sheet sections plus inst/vamp, repeats allowed) to assign names such as "Verse 2", "Chorus" and "Tag".
4. **Fuse**:
   - Audio boundaries decide *where* sections start and end.
   - The lyric match decides the *name* of vocal segments.
   - The audio label decides non-vocal segments: intro, instrumental becomes Interlude/Turnaround, outro.
   - Merge adjacent same-name segments, and flag low-confidence segments for human review in the UI.
5. **Optional**: have an LLM (text only) tidy the final label sequence. Don't use audio LLMs for boundaries.
6. **Evaluate**: hand-annotate about 30 local worship recordings (studio and live) and track HR.5F, HR3F and label ACC with mir_eval.

Skipped: nothing was benchmarked, and SongFormer's pip/CPU behaviour was not verified hands-on. That should be the first spike before committing to it.
