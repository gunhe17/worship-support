# Key & key-change detection — research report (2026-09-28)

> Source: Claude research subagent (web search/fetch). Preserved verbatim.

## 1. Global key

- **Chroma + key profiles**: 12-bin chroma (HPCP/CQT) correlated with 24 rotated templates — Krumhansl-Schmuckler, Temperley, Shaath, EDMA/EDMM (tuned for EDM), bgate (pop/rock). Essentia `KeyExtractor`/`Key` `profileType` options: `diatonic, krumhansl, temperley, weichai, tonictriad, temperley2005, thpcp, shaath, gomez, noland, edmm, edma, bgate, braw`; recent releases use **bgate as default**. Temperley was fitted to classical; Krumhansl is reasonable for pop. (https://essentia.upf.edu/reference/streaming_Key.html, https://github.com/MTG/essentia/releases)
- **Deep models** (GiantSteps test, MIREX weighted score): KeyFinder (classic) 59.3 · ConvKey (Korzeniowski & Widmer 2017 — this is madmom's `CNNKeyRecognitionProcessor`) 74.3 · AllConv "genre-agnostic" 2018 74.6 · InceptionKeyNet 75.7 (weights not released) · MERT-95M probe 73.0 · **KeyMyna (2026, Myna masked-contrastive embeddings + MLP) 75.9 — current SOTA**, public weights. On McGill Billboard: AllConv 85.1, KeyMyna 84.4. (https://arxiv.org/abs/2604.10021 Table 1; https://arxiv.org/abs/1808.05340; code github.com/echo-cipher/keymyna)
- Takeaway: deep models beat templates by ~15 pts on EDM; on pop/worship (diatonic, clear harmony) gaps are much smaller.
- **Datasets**: GiantSteps Key (604 test), GiantSteps MTG Key (1,486 train), McGill Billboard key subset (625 songs), GTZAN key annotations. MIREX 2025 task page exists (https://music-ir.org/mirex/wiki/2025:Audio_Key_Detection); no public 2024/2025 results tables found.
- **MIREX weighted score**: correct=1, fifth=0.5, relative=0.3, parallel=0.2.

## 2. Local key / modulation detection

- **Windowed key + HMM/Viterbi**: 24 key states; emissions = template correlations or CNN posteriors over ~8–30 s windows; transition matrix with strong self-loop and small, circle-of-fifths-weighted jumps. Local key estimation (LKE) is much less studied than global. Schreiber, Weiß & Müller (ICASSP 2020) compared HMM vs CNN LKE on Winterreise: both ~70% frame accuracy on unseen songs/versions; errors mostly musically related (fifth/relative). (https://www.audiolabs-erlangen.de/content/05_fau/professor/00_mueller/03_publications/2020_SchreiberWM_LocalKey_ICASSP_PrintedVersion.pdf; 2024 regularization approach: https://journals.sagepub.com/doi/full/10.1177/10298649241245075)
- **Chord-based**: recognize chords, then infer key over sliding window by chord histogram (diatonic membership). Options: Chordino/NNLS-Chroma (GPL-2+, Vamp plugin, callable via `vamp` Python pkg; https://github.com/c4dm/nnls-chroma), BTC (MIT, last updated 2020; https://github.com/jayg996/BTC-ISMIR19), ChordFormer (2025, conformer, large vocab; https://arxiv.org/abs/2502.11840). autochord: last release 0.1.4 in 2021 — effectively unmaintained.
- **Transposed repeats (best fit for worship "last chorus up a step")**: Optimal Transposition Index (OTI) from cover-song ID — circularly shift chroma of segment B by k=0..11, pick k maximizing correlation with segment A. Or a transposition-invariant self-similarity matrix (Müller): a repeated chorus appears on the k=+1 or +2 diagonal. Essentia ships `ChromaCrossSimilarity(oti=True)`. (https://mtg.github.io/essentia-labs/news/2019/09/05/cover-song-similarity/, http://mtg.upf.edu/system/files/projectsweb/jserra10coveridreview.pdf)
- Genre note: "truck driver's gear change" (+1/+2 semitones late in song) is the dominant modulation type in pop/CCM (https://tvtropes.org/pmwiki/pmwiki.php/Main/TruckDriversGearChange) — a prior on +1/+2 jumps in the last 40% of the song is justified.

## 3. Pitfalls

- **Relative major/minor & fifth confusions** are the main error types (see Fifth/Relative/Parallel columns in the KeyMyna table). Resolve relative major/minor with bass note / final chord.
- **Tuning offset (A≠440)**: estimate first — `librosa.estimate_tuning` or Essentia `TuningFrequency`/HPCP `referenceFrequency`; build chroma at that reference. Otherwise a quarter-tone-off recording smears between bins.
- **Drums/vocals** smear chroma. A 2025 APSIPA paper got chord recognition gains by running htdemucs and analyzing drum-removed and drum+vocal-removed mixes plus the bass stem (http://www.apsipa.org/proceedings/2025/papers/APSIPA2025_P307.pdf). For key, feeding "other + bass" (drums/vocals removed) is a cheap, well-supported improvement. Demucs 4.1.0 is on PyPI (MIT, July 2026).
- **Short windows** flip-flop; require a change to persist ≥ ~8 bars and be confirmed by OTI of a repeated section.

## 4. Commercial tools

- Mixed In Key: licensed tONaRT engine + own patented algorithm; proprietary; single key output (https://en.wikipedia.org/wiki/Mixed_In_Key).
- Moises: AI key + chord detection after stem separation, with pitch shifter; no modulation detection mentioned in marketing (https://moises.ai/features/key-detector/).
- Tunebat: "AI/ML" only; Chordify: chord-based, no public algorithm details. None document modulation output.
- Spotify `audio-features`/`audio-analysis` (which had key, mode, and per-section keys) closed to new apps since 2024-11-27 → 403 (https://musically.com/2024/11/28/spotify-removes-features-from-web-api-citing-security-issues/).

## 5. Packaging / licenses (checked on PyPI/GitHub today)

| Package | Status | License |
|---|---|---|
| essentia | 2.1b6.dev1438, wheels 2026-05; repo active 2026-09 | **AGPL-3.0** (issue for closed/SaaS) |
| madmom | PyPI stuck at 0.16.1 (2018), breaks on Python ≥3.10; GitHub main still gets commits (2026-03) — install from git | code BSD, **models CC BY-NC-SA** (no commercial use) |
| librosa | 1.0.0 (2026-08), Python ≥3.12 | ISC |
| demucs | 4.1.0 | MIT |
| KeyMyna | GitHub code only, not on PyPI, last push 2025-02 | none declared |
| music21 | 10.5 | BSD (symbolic only) |

## 6. Recommended pipeline

1. **Separate**: htdemucs → keep bass+other (drop drums/vocals).
2. **Tuning**: `librosa.estimate_tuning` on the harmonic stem.
3. **Features**: beat-synchronous CQT chroma (librosa, ISC), tuning-corrected.
4. **Local key**: sliding windows (8–16 beats), score against 24 profiles (Krumhansl or bgate; `essentia.Key` if AGPL is acceptable, otherwise ~20 lines of numpy). Then Viterbi over 24 states with self-transition ~0.99 and a small bonus for ±1/±2 semitone same-mode jumps.
5. **Global key** = majority of the Viterbi path; optionally cross-check with madmom CNN (non-commercial only) or KeyMyna.
6. **Modulation confirmation**: segment the song (SSM) → find repeated choruses → for each later repeat compute OTI vs first occurrence. If OTI=+1/+2 and it agrees with the Viterbi jump, emit the change, with its time snapped to the nearest downbeat / section boundary.
7. Output e.g. `G major (0:00–3:12) → A major (3:12–end)`.
8. Optional: chords (BTC MIT or Chordino GPL) to resolve relative major/minor and to show chord charts.

**Skipped**: training a custom local-key model. Templates + Viterbi + OTI check should cover diatonic worship music; consider a trained model only if validation on a few dozen labeled worship songs shows the templates failing.
