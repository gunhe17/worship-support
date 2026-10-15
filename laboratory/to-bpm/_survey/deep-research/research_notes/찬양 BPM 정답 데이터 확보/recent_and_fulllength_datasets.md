# Recent (2022–2026) and lesser-known ground-truth datasets for tempo, beat, downbeat, and tempo change (for evaluating worship songs)

Researched 2026-10-13. Scope excludes the classic sets (Ballroom, Hainsworth, SMC, RWC, Beatles, Harmonix, GiantSteps, GTZAN), which another researcher covers. They come up here only where a newer resource re-annotates or re-analyzes them.

## Q1. What new beat, downbeat, and tempo datasets or annotation releases appeared in 2022–2026?

### Takeaway
There are few new full-song datasets with human-checked beats in pop or rock. The most useful releases are:
- the Beat This! annotation bundle (16 datasets, MIT, v1.1 corrections);
- BeatNet+'s new beat and downbeat annotations for MUSDB18 (150 full songs, audio obtainable) and URSing;
- Osu2MIR, beat and downbeat labels drawn from rhythm-game charts (708 audios, high-quality subset);
- Raveform, EDM DJ mixes with 1,423 expert-annotated tracks.

None of them contains worship, CCM, or gospel music.

### Cited Findings
- **Beat This! (Foscarin, Schlüter, Widmer, ISMIR 2024)** trains and validates on 4,556 tracks across 18 dataset splits and tests on GTZAN (993 pieces).
  - Training sources: Simac, SMC, Hainsworth, Ballroom, HJDB, Beatles, Harmonix, RWC (Classical, Pop, Royalty-free, Jazz), TapCorrect, JAAH, Filosax (backing tracks only), ASAP (tracks with "rubato" beat annotations discarded), Groove MIDI (provided audio renderings), GuitarSet (comping only), and Candombe.
  - Augmentation: tempo changes of ±4–20% and pitch shifts of +6/−5 semitones.
  - The paper does not claim any new annotations. It lists dataset correction as future work.
  - [arXiv 2407.21658](https://arxiv.org/html/2407.21658)
- **beat_this_annotations repo (MIT license).**
  - v1.0 holds the annotations used in the paper. v1.1 corrects them.
  - JAAH: existing beats corrected and downbeats added by Vogl and Foscarin.
  - Filosax: partially corrected.
  - RWC Pop: corrected by Böck, then further in v1.1.
  - Harmonix: reproduced and partially corrected from Hung et al. 2022 (arXiv 2205.14701).
  - TapCorrect, Candombe, GuitarSet, ASAP, and Groove MIDI are linked to their original sources.
  - Audio is not included.
  - [GitHub CPJKU/beat_this_annotations](https://github.com/CPJKU/beat_this_annotations)
- **TapCorrect (Driedger, Schreiber, de Haas, Müller, ISMIR 2019; Chordify).** Beat annotations for 101 recordings. Human taps were "snapped" to nearby audio cues. Audio has to be obtained from the original sources; the annotation pages give links for this. — [ISMIR 2019 paper](https://www.audiolabs-erlangen.com/content/05_fau/professor/00_mueller/03_publications/2019_DriedgerSHM_BeatAnn_ISMIR_PrintedVersion.pdf); [Zenodo record that lists tapcorrect](https://zenodo.org/records/13922116)
- **BeatNet+ (Heydari et al., TISMIR 2024)** releases new annotations and revises some existing ones:
  - New beat and downbeat annotations for MUSDB18 (150 pieces) and URSing (65 pieces).
  - Revised annotations for RWC Jazz (50), RWC Pop (100), and RWC Royalty-free (15).
  - Training and validation also used Ballroom, Hainsworth, and Rock Corpus; GTZAN is the test set.
  - Annotations: [github.com/mjhydri/BeatNet-Plus/tree/main/annotations](https://github.com/mjhydri/BeatNet-Plus/tree/main/annotations). The paper states no annotation license.
  - [TISMIR article](https://transactions.ismir.net/articles/10.5334/tismir.198)
- **Osu2MIR (Liu & Donahue, arXiv September 2025).**
  - Beats and downbeats come from community osu! beatmaps. Genres skew to anime, Vocaloid, and game music.
  - The released subset osu2beat2025 has 741 annotations for 708 distinct audios.
  - Charts are split by "uninherited timing points" (osu!'s tempo-change markers):
    - Subset 1: a single timing point (constant tempo).
    - Subset 2: multiple points at least 5 s apart.
    - Subset 3: multiple points less than 5 s apart (use with caution).
  - Audio is not distributed ("We do not own the copyright"). Users download the .osz from osu.ppy.sh and verify the MD5. No license is stated.
  - [arXiv 2509.12667](https://arxiv.org/abs/2509.12667); [GitHub osu2mir](https://github.com/ziyunliu4444/osu2mir)
- **Raveform (Kim, Kim, Kim, Nam, TISMIR 2026).**
  - Scale: 4,902 DJ mixes (about 6,522 h), 56,873 unique tracks, and 53,780 transitions. Automatic beats cover all mixes and tracks.
  - 1,423 tracks have expert annotations (tempo, beats, downbeats, segments). Three experts corrected Rekordbox beat grids.
  - Tracks with substantial tempo changes and unstable grids were excluded.
  - Only links are provided; audio comes from YouTube and MixesDB. No license is stated.
  - [TISMIR article](https://transactions.ismir.net/articles/288); [project site](https://mir-aidj.github.io/raveform/)
- **MulTTiPop (arXiv July 2026).** 572 pop segments (3.5 h) paired with multitrack MIDI that is warped to the audio's tempo and timing, using a manually set anchor beat plus beat tracking. Beat labels are therefore partly automatic. Audio availability is unclear. — [arXiv 2607.08756](https://arxiv.org/abs/2607.08756); [project](https://gclef-cmu.org/multtipop)
- **JazzSAMBA (arXiv September 2026, submitted to ICASSP 2027).**
  - 76 jazz standards recorded by 8 musicians under two protocols: live ensemble (synchronous) and overdubbed (asynchronous).
  - Timed bar, chord, section, and soloist annotations. Beats and tempo are not mentioned.
  - Stems, mixtures, and MIDI are released. The license is not stated on arXiv.
  - [arXiv 2609.34931](https://arxiv.org/abs/2609.34931)
- **METER2800 (Data in Brief, 2023).** A time-signature dataset with one tempo per track (rock, pop, classical, jazz). It has no time-varying tempo. — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2352340923008053)

### Inferences
- **Most useful for worship-style pop/rock band audio with full songs and obtainable audio:**
  - MUSDB18 with the BeatNet+ annotations. Real multitrack pop/rock songs, and the drum stem helps diagnose octave errors.
  - Harmonix, using the Beat This! corrected version.
  - The Rock Corpus beats used by BeatNet+.
- **Osu2MIR is the only new source that explicitly flags tempo-change songs (subsets 2 and 3).** It is useful as a tempo-change stress test, but its genres are far from CCM.
- **Raveform is mostly constant-tempo EDM.** It is only marginally relevant: it covers octave ambiguity on four-on-the-floor music, but not live tempo drift.

### Gaps
- Exact sizes, durations, and licenses for JAAH, Filosax, Candombe, GuitarSet, and Groove MIDI were not verified in this pass.
- I found no primary source for the "Beat-It" / "BeatFM" or MERT/MuQ beat-tracking evaluations in this pass. Foundation-model benchmarks such as MARBLE are believed to use GTZAN beats, which is a classic set, but this is not verified here.
- I did not confirm Raveform's release status or license; the article says the data "will be publicly released."

## Q2. Are there annotated gospel, CCM, worship, or church music datasets (including Korean)? Any live-recording beat datasets?

### Takeaway
I found no public dataset with beat, downbeat, or tempo annotations for gospel, CCM, worship, or church music, Korean or otherwise. Live-recording beat datasets are also essentially absent. The closest are live-ensemble jazz (JazzSAMBA, with bars only) and bar-level annotations of live opera.

### Cited Findings
- **Searches of mirdata's dataset list and general MIR dataset lists found no gospel or worship beat or tempo datasets.**
  - The only sacred-music dataset found is an Ethiopian Orthodox chant corpus (2024). It has pitch and mode labels, not beats.
  - [mirdata quick reference](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html); [Lerch MIR dataset list](https://gist.github.com/alexanderlerch/e3516bffc08ea77b429c419051ab793a); [Ethiopian chant arXiv 2412.18788](https://arxiv.org/pdf/2412.18788)
- **A Korean-language search (찬양/CCM BPM dataset) returned no worship-specific datasets.** It did surface TimeCues Studio (arXiv 2609.10338), an annotation tool with fixed-BPM, variable-tempo, and manual beat-grid modes and JAMS export. It could support in-house annotation. — [arXiv 2609.10338](https://arxiv.org/pdf/2609.10338)
- **Live audio is hard to annotate.**
  - ADTOF's authors note that tempo drifts in live-performance tracks and that chart timing errors reach about 50 ms.
  - The live opera tracking work hand-annotated more than 10,000 bars of live Vienna State Opera recordings. This is bar-level and not a beat-tracking dataset.
  - [ADTOF arXiv 2111.11737](https://arxiv.org/pdf/2111.11737); [arXiv 2010.11013](https://arxiv.org/pdf/2010.11013)
- **JazzSAMBA's synchronous protocol is a "live ensemble" recording with timed bar annotations.** — [arXiv 2609.34931](https://arxiv.org/abs/2609.34931)

### Inferences
- **A worship-specific ground-truth set will have to be built in-house.** A practical recipe:
  - Tap or seed beats with Beat This! or madmom.
  - Correct them by hand in TimeCues Studio, Sonic Visualiser, or Rekordbox, which is the Raveform workflow.
  - Optionally snap the taps TapCorrect-style.
- **Multitrack or click sources from church services can supply near-exact tempo ground truth.** Many contemporary worship bands play to a click or track (MultiTracks.com-style stems), which can serve as ground truth. This is an inference and not sourced.

### Gaps
- Domestic Korean journals (e.g., 한국음악정보학회 publications) were not searched in depth.
- I found no evidence of gospel or CCM subsets inside Harmonix or MUSDB18. Genre composition was not checked.

## Q3. Which datasets contain tempo changes or time-varying tempo annotations?

### Takeaway
Explicit tempo-change ground truth exists mainly in:
- classical or expressive sets (ASAP, used in Beat This!; its rubato-annotated tracks are explicitly flagged);
- POP909, which has manually labeled tempo curves (Chinese pop, piano MIDI);
- Osu2MIR's multi-timing-point subsets.

I found no dedicated "tempo change detection" benchmark for pop or rock audio. The 2026 SMC failure analysis shows octave and tempo-instability failure modes are still open problems.

### Cited Findings
- **ASAP is in the Beat This! training set, but tracks with "rubato" beat annotations were discarded.** So the dataset does mark rubato. — [Beat This! arXiv 2407.21658](https://arxiv.org/html/2407.21658)
- **POP909 provides manually labeled tempo curves per song.** Beat, key, and chord labels are machine-extracted. — [ISMIR 2020 paper](https://archives.ismir.net/ismir2020/paper/000089.pdf); summarized in this [search result](https://arxiv.org/pdf/2008.07142)
- **Osu2MIR subsets 2 and 3 contain charts with several tempo markers.** Subset 3 (markers less than 5 s apart) is less reliable. — [GitHub osu2mir](https://github.com/ziyunliu4444/osu2mir)
- **"The SMC Blind Spot" (Ahn, Hwang, Jung, arXiv May 2026, prepared for ISMIR 2026)** identifies three failure modes on SMC: octave errors, continuity errors, and complete failure.
  - The standard DBN's default 55 BPM minimum tempo blocks correct inference on 21% of SMC tracks and forces double-tempo predictions on slow music.
  - Suggested fixes are training-data diversification and multi-hypothesis tempo estimation.
  - [arXiv 2605.12287](https://arxiv.org/abs/2605.12287)
- **Earlier work notes that beat trackers "have not learned to adapt to the tempo changes"** and proposes a metric-level switching analysis. — [arXiv 2210.06817](https://arxiv.org/pdf/2210.06817)
- **Tempo-invariant downbeat tracking built a synthetic test set** by rendering Groove MIDI at scaled tempi. This is constant rescaling, not accelerando. — [arXiv 2102.02282](https://arxiv.org/abs/2102.02282)
- **Tempo-variability analysis:** SMC has the highest share of tracks with large tempo variability. — [Schreiber et al., TISMIR "Are We Done Yet?"](https://transactions.ismir.net/articles/10.5334/tismir.43)

### Inferences
- **The 55 BPM DBN floor matters directly for slow worship ballads (about 60–75 BPM, often felt in half-time).** When evaluating the 14 methods, check whether each method's min/max BPM range clips the true tempo. Report Acc1, Acc2, and octave-error rates separately.
- **A synthetic tempo-change benchmark is easy to build:** apply piecewise time-stretching to constant-tempo multitracks such as MUSDB18. This is not a published dataset, but it gives exact ground truth.

### Gaps
- No verified data on Mazurka or Chopin tempo-curve datasets in this pass (pre-2022 in any case).
- No published synthetic accelerando or ritardando benchmark found.

## Q4. How feasible are MIDI-aligned or game-chart-derived beat datasets (Lakh, Rock Band/Clone Hero, osu!, StepMania), and what about licenses?

### Takeaway
Rhythm-game charts are the most scalable source of real-song beat, downbeat, and tempo-map ground truth, including tempo changes. However:
- the audio is copyrighted and must be fetched by users;
- licenses are unclear or non-commercial;
- community chart timing can be off by tens of milliseconds.

### Cited Findings
- **ADTOF** was built from openly shared custom rhythm-game charts, which contain beat information, metadata, and the audio.
  - The repo is licensed CC BY-NC-SA 4.0.
  - The dataset copy is available on request via Zenodo.
  - [arXiv 2111.11737](https://arxiv.org/pdf/2111.11737); [GitHub ADTOF](https://github.com/MZehren/ADTOF)
- **STRUM (arXiv 2026):** only 89.0% of Clone Hero ground-truth drum events lie within ±100 ms of any detected audio onset, so community chart timing drifts. — [arXiv 2605.12135](https://arxiv.org/pdf/2605.12135)
- **scan-chart** parses Clone Hero charts (validated on 40,000 charts) and exposes a tempo-map hash and BPM-marker counts. — [GitHub scan-chart](https://github.com/Geomitron/scan-chart)
- **Osu2MIR says ADTOF is the only well-known MIR dataset based on rhythm-game charts.** It finds beatmaps with sparse timing points more reliable. — [arXiv 2509.12667v1](https://arxiv.org/html/2509.12667v1)
- **MulTTiPop warps Lakh MIDI and TheoryTab MIDI to real recordings.** It notes that MIDI has strict grids while recordings drift in tempo. — [arXiv 2607.08756](https://arxiv.org/abs/2607.08756)

### Inferences
- **Clone Hero and Rock Band chart packs include some CCM and Christian rock songs** (e.g., community packs). Their tempo maps (BPM markers per measure, time signatures) could give approximate beat, downbeat, and tempo-change ground truth for worship-adjacent songs. Spot-check timing against the audio, given the ±50–100 ms drift reports. This is unverified: I did not confirm that CCM charts exist.
- **For research use, annotations-only release with user-fetched audio is the norm** (Osu2MIR, Raveform, TapCorrect).

### Gaps
- No StepMania-based beat dataset found. No Rock Band official-chart dataset found. License status of community charts as a category is unresolved.
- No verified 2022–2026 Lakh-MSD beat benchmark found.

## Comparison table

| Dataset (year) | Size | Full songs? | Annotations | Tempo changes | Live? | Audio | License | Link |
|---|---|---|---|---|---|---|---|---|
| Beat This! annotations v1.1 (2024) | 16 datasets; 4,556 train + 993 test tracks | Mixed | beats + downbeats | ASAP and others (rubato flagged) | No | Not included | MIT (annotations) | [GitHub](https://github.com/CPJKU/beat_this_annotations) |
| BeatNet+ MUSDB18 / URSing (2024) | 150 / 65 pieces | Yes (MUSDB) | beats + downbeats | Not flagged | No | MUSDB18 obtainable (stems) | Not stated | [GitHub](https://github.com/mjhydri/BeatNet-Plus/tree/main/annotations) |
| TapCorrect (2019, used in 2024) | 101 recordings | Yes | beats (+downbeats in Beat This!) | Not flagged | No | Links to sources | Not verified | [paper](https://www.audiolabs-erlangen.com/content/05_fau/professor/00_mueller/03_publications/2019_DriedgerSHM_BeatAnn_ISMIR_PrintedVersion.pdf) |
| Osu2MIR / osu2beat2025 (2025) | 741 annotations, 708 audios | Unclear | beats + downbeats, timing points | Yes (subsets 2 and 3) | No | User downloads from osu! | Not stated | [GitHub](https://github.com/ziyunliu4444/osu2mir) |
| Raveform (2026) | 4,902 mixes; 1,423 expert tracks | Yes (EDM tracks + mixes) | tempo, beats, downbeats, segments | Excluded unstable tracks | DJ mixes | YouTube/MixesDB links | Not stated | [site](https://mir-aidj.github.io/raveform/) |
| MulTTiPop (2026) | 572 segments, 3.5 h | No (segments) | MIDI warped to audio | Implicit (warp) | No | Unclear | Not stated | [project](https://gclef-cmu.org/multtipop) |
| JazzSAMBA (2026) | 76 standards | Yes | bars, chords, sections | Implicit | Live ensemble takes | Stems + mixes | Not stated | [arXiv](https://arxiv.org/abs/2609.34931) |
| POP909 (2020) | 909 songs | Yes (MIDI) | tempo curves (manual), beats (auto) | Yes (curves) | No | MIDI only | See repo | [paper](https://archives.ismir.net/ismir2020/paper/000089.pdf) |
| ADTOF (2021) | Rhythm-game charts | Yes | drums + beats (charts) | Chart tempo maps | No | On request | CC BY-NC-SA 4.0 | [GitHub](https://github.com/MZehren/ADTOF) |
| METER2800 (2023) | 2,800 | Mixed | meter + global tempo | No | No | See paper | See paper | [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2352340923008053) |
| Rock Corpus (2011, used by BeatNet+) | 200 songs | Yes | beats + downbeats | Not flagged | No | Not included | See site | [rockcorpus](https://rockcorpus.midside.com/) |
| Gospel / CCM / worship | None found | — | — | — | — | — | — | — |
