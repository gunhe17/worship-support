# Full-length pop/rock datasets with beat/downbeat/tempo ground truth AND free audio (as of 2026-10-13)

Verification method: file listings were pulled directly from the GitHub REST API (git trees), the Hugging Face Hub API (`/api/datasets/<repo>/tree`), and the Zenodo records API. Remote ZIPs were opened with HTTP range requests to list their members and read WAV headers. Labels used below:
- **VERIFIED**: I saw the file listing or file contents myself in this session.
- **CLAIMED**: the only evidence is README or paper text.

Model training-set overlap uses the lists given in the assignment. For Beat This!, the overlap was confirmed against the `CPJKU/beat_this_annotations` tree.

## Q1. Which candidates actually give free audio + beat/downbeat/tempo labels for full-length pop/rock?

### Takeaway
Two sources are fully usable today without any purchase. Both were VERIFIED.
- **RWC Music Database 2.0** (re-released on Zenodo in Feb 2026 under CC BY-NC 4.0): real CD-quality WAV audio, with beat/downbeat annotations in `rwc-music/rwc-annotations`. The RWC-G subset holds 12 pop/rock tracks and 15 dance/R&B tracks, and **RWC-G is NOT in Beat This!'s training set**.
- **m-a-p/harmonixset_bigvgan** on Hugging Face: 912 full-length Harmonix Set tracks as BigVGAN-vocoded 22.05 kHz mono WAV. The vocoder resynthesized them from the official mel spectrograms, so they sit on the annotation timeline.

Everything else either has no labels (FMA), needs YouTube or osu! downloads (Harmonix originals, Osu2MIR), is synthetic (Slakh), or is 30 s clips (GTZAN).

### Cited Findings

**A. RWC Music Database 2.0: audio is now free (VERIFIED)**
- Zenodo record 18656623 "RWC Music Database":
  - License `cc-by-nc-4.0`, access `open`, created 2026-02-16.
  - Files: `RWC-P.zip` 4072 MB, `RWC-G.zip` 3933 MB, `RWC-C.zip` 2966 MB, `RWC-J.zip` 2128 MB, `RWC-R.zip` 320 MB, `changelog.txt`.
  - The description says: "In 2026, the dataset was released under the Creative Commons Attribution-NonCommercial 4.0 International license … This repository contains audio data only", and it points to https://github.com/rwc-music/rwc-annotations for the annotations.
  - Source: [Zenodo API record 18656623](https://zenodo.org/api/records/18656623) / [Zenodo page](https://zenodo.org/records/18656623)
- I listed `RWC-G.zip` remotely: it has 103 members, of which 102 are `.wav`. One example is `RWC-G/RWC_G008.wav` at 36,030,592 bytes. For a 204 s track that size implies 44.1 kHz / 16-bit / stereo (inferred) — [RWC-G.zip](https://zenodo.org/records/18656623/files/RWC-G.zip)
- `rwc-music/rwc-annotations` (license file: CC BY-NC 4.0; last push 2026-06-26):
  - Beats are at `01_annotations_preprocessed/beats/RWC-{C,G,J,P,R}`, with 61 / 102 / 50 / 100 / 15 files respectively.
  - Format: semicolon-separated `t;beat`, e.g. `0.020;1`, `0.540;2` (the beat number gives the downbeat).
  - The beats README says these are the AIST annotations merged with the CPJKU Beat This! corrections, sonified and quality-checked in Oct 2025 by Balke & Özgün.
  - `metadata.csv` has a per-track `Tempo` column, `GenreMain` / `GenreSub`, and `audio_start` / `audio_end` / `duration`.
  - Source: [rwc-annotations repo](https://github.com/rwc-music/rwc-annotations), [beats README](https://github.com/rwc-music/rwc-annotations/blob/main/01_annotations_preprocessed/beats/README.md), [metadata.csv](https://github.com/rwc-music/rwc-annotations/blob/main/metadata.csv)
- RWC-G genre breakdown, from `metadata.csv` (102 entries):
  - Popular 6 (G001–G006: 3 Popular, 3 Ballade)
  - Rock 6 (G007–G012: 3 Rock, 3 Heavy Metal)
  - Dance 15 (G013–G027: Rap/Hip-Hop, House, Techno, Funk, Soul/R&B, 3 each)
  - The rest are World, Classical, Latin, Jazz, Japanese traditional, Vocal, March, and A cappella.
  - Durations for G001–G027 are about 161–368 s, i.e. full-length.
  - Source: [metadata.csv](https://github.com/rwc-music/rwc-annotations/blob/main/metadata.csv)
- The Beat This! training annotations for RWC have 226 files: 100 `rwc_popular`, 15 `rwc_royalty_free`, 50 `rwc_jazz`, 61 `rwc_classical`. **No RWC-G files** — [beat_this_annotations/rwc](https://github.com/CPJKU/beat_this_annotations/tree/main/rwc/annotations/beats)
- mirdata's `rwc_popular` loader now points to the Zenodo record 18656623 — [mirdata rwc_popular.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/rwc_popular.py)
- Reference paper: Balke et al., "RWC Revisited: Towards a Community-Driven MIR Corpus", TISMIR 9(1), Feb 2026 (CLAIMED; cited in the Zenodo description) — [doi:10.5334/tismir.326](https://dx.doi.org/10.5334/tismir.326)

**B. Harmonix Set: vocoded full audio on Hugging Face (VERIFIED)**
- `m-a-p/harmonixset_bigvgan`:
  - Public, not gated, no dataset card or license field, created 2025-08-20.
  - 3 files: `harmonixset_bigvgan.zip` (about 8.5 GB total repo), `harmonixset.corrected.20250821.jsonl`, `.gitattributes`.
  - The ZIP has 915 members, of which **912 are `.wav`** under `harmonixset_bigvgan/tracks/<File>.wav`, plus a `.scp` list.
  - I read the header of `0001_12step.wav`: **1 channel, 16-bit, 22,050 Hz, 142.38 s**. The Harmonix `metadata.csv` gives 142.47 s for the same track, so it is the full song on the original annotation timeline.
  - The jsonl holds only structure segments (`msa_info`) and a train/val/test split, no beats. Beats come from the official repo.
  - Source: [HF repo](https://huggingface.co/datasets/m-a-p/harmonixset_bigvgan), [HF tree API](https://huggingface.co/api/datasets/m-a-p/harmonixset_bigvgan/tree/main?recursive=true)
- Official Harmonix repo `urinieto/harmonixset`:
  - `dataset/beats_and_downbeats` has 912 `.txt` files (plus the dir entry). Format: `time<TAB>beat_in_bar<TAB>bar_no`, e.g. `0.0 1 1`.
  - Also present: `dataset/jams`, `segments`, `metadata.csv` (which includes BPM and Genre), `youtube_urls.csv` (912 rows), and `youtube_alignment_scores.csv` (DTW scores).
  - GitHub reports the repo license as MIT; the Zenodo record says CC BY 4.0.
  - Source: [harmonixset repo](https://github.com/urinieto/harmonixset), [Zenodo 3527870](https://zenodo.org/records/3527870)
- The official README says mel spectrograms of the original audio are on Dropbox (`Harmonix_melspecs.tgz`, about 1.2 GB) — [README](https://github.com/urinieto/harmonixset). I infer the BigVGAN WAVs were vocoded from these, which would explain why they are mono at 22.05 kHz.
- Beat This! uses corrected Harmonix beats (911 files; "reproduced and partially corrected" per arXiv 2205.14701, plus one fix in v1.1) — [beat_this_annotations README](https://github.com/CPJKU/beat_this_annotations)
- A Harmonix user in issue #18 (Oct 2025) reports the official annotations differ from the Beat This! version.
- `Archit00/harmonix-mirror` (HF) holds annotations only: 912 beat txt files and 64 jams files, **no audio** — [HF repo](https://huggingface.co/datasets/Archit00/harmonix-mirror)

**C. Harmonix YouTube availability (VERIFIED by my own check, 2026-10-13)**
- I queried the YouTube oEmbed endpoint for all 912 URLs in `youtube_urls.csv`:

  | Status | Count | Meaning |
  |---|---|---|
  | 200 | 863 (94.6%) | public |
  | 404 | 37 | removed or private |
  | 403 | 7 | |
  | 401 | 5 | embedding disabled; may still be playable |

  Method: my own script in this session. oEmbed 200 does not guarantee that yt-dlp can download the video or that it is available in every region.
- PR #16 (Mar 2025, still unmerged) adds `youtube_urls_with_speed.csv` with `link_valid=True` for all 912. The maintainer doubted this, noting that only 3 rows have speed≠0 while the original had at least 9 — [PR #16](https://github.com/urinieto/harmonixset/pull/16)
- The maintainer (Oct 2025) says 30–40% of tracks were pre-processed by Harmonix, possibly time-stretched, so original releases "may not align perfectly". A PhD user reports that DTW from YouTube "was not particularly accurate" — [issue #18](https://github.com/urinieto/harmonixset/issues/18)
- Issue #9 (2021) reports that YouTube downloads do not line up with the annotations even at alignment score 1.0, and also notes MP3 decoder offsets. The maintainer cannot distribute audio — [issue #9](https://github.com/urinieto/harmonixset/issues/9)

### Inferences
- **The best "unseen by Beat This!" full-length pop/rock set is RWC-G Popular+Rock+Dance**: 27 tracks, about 1.7 h, real audio, curated downbeats.
- RWC-P is now free too (100 tracks, J-pop/80s US-style pop). It is in the training sets of Beat This! and madmom, so it is an in-distribution sanity check, not a fair test.
- BeatNet's list (Ballroom, Beatles, Carnatic, Rock Corpus, ±GTZAN) does not include RWC, so RWC-P is unseen for BeatNet. DeepRhythm's training data is unknown.
- **Harmonix BigVGAN is the only way to get all 912 full songs aligned to the labels without manual DTW.** But it is vocoded:
  - mono, 22.05 kHz, probably band-limited and with artifacts;
  - Harmonix is in Beat This!'s training set (madmom and BeatNet were not trained on it).
  - Results on it should be read as relative rankings, not absolute accuracy.
- YouTube Harmonix gives about 95% live URLs, but per-track offsets and tempo changes make it unreliable as ground truth unless you align each track to the BigVGAN or mel audio first.

### Gaps
- No license or README is published for `m-a-p/harmonixset_bigvgan`. The redistribution status of the vocoded audio is unclear (the annotations are CC BY 4.0 / MIT, the original audio is copyrighted).
- I did not confirm which BigVGAN checkpoint or mel parameters were used, and I did not measure audio bandwidth.
- I did not verify that every RWC-G beat file has the downbeat column, nor the exact per-track WAV format (only file sizes were checked).
- I did not open `RWC-P.zip` (only its size was checked).

## Q2. Is there any other source of MUSDB18 beat/downbeat annotations?

### Takeaway
None found. BeatNet-Plus still has no annotation files. Papers that use MUSDB18 beat labels (BeatNet+ and the 2025 singing-voice adapter paper) give no download link I could find. MUSDB18 audio itself is widely mirrored on Hugging Face.

### Cited Findings
- The current `mjhydri/BeatNet-Plus` git tree (last push 2026-04-13) has **no path containing "annot"** (VERIFIED via the API) — [repo](https://github.com/mjhydri/BeatNet-Plus)
- The BeatNet+ TISMIR paper says MUSDB18 and URSing were annotated with BeatNet plus manual correction and "will be online" (CLAIMED) — [TISMIR article](https://transactions.ismir.net/articles/10.5334/tismir.198)
- arXiv 2503.10086 (singing-voice beat tracking with adapter tuning):
  - Its table lists MUSDB18 (6.4 h, 144 excerpts, "Pop., Country, Rock") and reports MUSDB beat/downbeat F1.
  - No annotation release link appears in the HTML (VERIFIED by grepping the HTML).
  - Source: [arXiv HTML](https://arxiv.org/html/2503.10086v1)
- I searched GitHub repositories for "musdb18 beat annotations" and "musdb downbeat": 0 results. I searched the HF Hub for "musdb": about 60 repos, all audio, stems, codec, or feature variants, and none named with beat or downbeat (VERIFIED, search API).
- The mirdata dataset loader list has no MUSDB and no beat set beyond the known ones (ballroom, beatles, brid, candombe, filosax, groove_midi, guitarset, hainsworth, rwc_*, simac, queen, …) — [mirdata datasets dir](https://github.com/mir-dataset-loaders/mirdata/tree/master/mirdata/datasets)

### Inferences
- Treat any MUSDB18 beat claim as unavailable unless the authors send files. Asking the BeatNet+ or 2503.10086 authors directly is the only route.

### Gaps
- I did not check all-in-one (Kim & Nam), drum-transcription, or structure papers individually for MUSDB beat releases. GitHub and HF searches found nothing.

## Q3. FMA with tempo annotations (tempo_eval)

### Takeaway
**Trap.** tempo_eval's FMA "references" contain **only genre tags, no tempo**. The tempo values in tempo_eval for FMA are algorithm estimates. FMA has no human tempo or beat ground truth.

### Cited Findings
- In `tempoeval/tempo_eval`:
  - `annotations/references/fma_small/jams` has 8,000 JAMS files and `fma_medium/jams` has 17,000.
  - I randomly sampled 15 files from each: **every annotation was namespace `tag_fma_genre`** (version 1.0.0, curator Defferrard). The example `000002.jams` has the value "Hip-Hop" and a duration of 29.99 s. (VERIFIED)
  - Source: [tempo_eval references](https://github.com/tempoeval/tempo_eval/tree/main/annotations/references)
- `annotations/estimates/fma_small` holds only algorithm outputs: `boeck2015`, `davies2009`, `percival2014`, `schreiber2014`, `schreiber2017`, `schreiber2018` (VERIFIED) — [estimates dir](https://github.com/tempoeval/tempo_eval/tree/main/annotations/estimates)
- FMA sizes (VERIFIED, from the README):
  - small: 8,000 × 30 s, 7.2 GiB
  - medium: 25,000 × 30 s, 22 GiB
  - large: 106,574 × 30 s, 93 GiB
  - **full: 106,574 untrimmed, 879 GiB**
  - Downloads are at `https://os.unil.cloud.switch.ch/fma/*.zip`. Audio is Creative Commons.
  - `echonest.csv` has Echonest/Spotify features, including tempo, for 13,129 tracks. These are algorithmic, not ground truth.
  - Source: [mdeff/fma README](https://github.com/mdeff/fma)

### Inferences
- FMA is useful only for agreement analysis between trackers, not for accuracy.

### Gaps
- I did not check whether the FMA download host is still up in Oct 2026.

## Q4. Hainsworth, Rock Corpus, Robbie Williams, Beatles, Queen, SMC, SIMAC: any legal free audio?

### Takeaway
No free audio for any of these, except **RWC**, which became free in 2026 (see Q1).

### Cited Findings
- mirdata says "Unfortunately the Hainsworth dataset is not available for download" — [hainsworth.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/hainsworth.py)
- mirdata says "Unfortunately the audio files of the Beatles dataset are not available" — [beatles.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/beatles.py)
- mirdata says "the SIMAC Rhythm dataset is not available for download" — [simac.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/simac.py)
- mirdata's Queen loader lists the commercial CDs used (e.g. Greatest Hits II, CDP 7979712) — [queen.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/queen.py)
- Robbie Williams and Rock Corpus (RS200): no free audio source found. The audio is commercial recordings, so only annotations exist. This is CLAIMED from general knowledge; I found no source offering the audio.

### Gaps
- I did not search for legal audio for Robbie Williams or Rock Corpus beyond the absence in mirdata.

## Q5. Other candidates: Jamendo, DALI, MedleyDB, Mixing Secrets, Slakh, Osu2MIR, GTZAN

### Takeaway
- None of Jamendo, DALI, or MedleyDB ships beat or tempo ground truth.
- **Slakh2100** (CC BY 4.0, full-length, synthesized from Lakh MIDI with the MIDI included) lets you derive exact beats from the MIDI tempo map. Synthetic audio.
- **Osu2MIR** has 741 human beat annotations, but the audio must be fetched from osu! (copyrighted, mostly anime/J-pop).
- **GTZAN** audio plus beats is free but consists of 30 s clips. It is Beat This!'s held-out test set.

### Cited Findings
- **DALI**:
  - The `info` fields are id, artist, title, scores, audio url (YouTube) and `working`, plus metadata (album, genres, language).
  - The annotations are lyrics and notes; no beat or tempo field.
  - Audio comes via `youtube_dl`.
  - (VERIFIED from the README) — [DALI README](https://github.com/gabolsgabs/DALI)
- **MedleyDB**: the sample metadata YAML (`AClassicEducation_NightOwl_METADATA.yaml`) has artist, genre, stems and instruments, and **no tempo or beat field** (VERIFIED, one file). mirdata lists MedleyDB only for melody and pitch — [medleydb repo](https://github.com/marl/medleydb), [mirdata quick reference](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html)
- **MTG-Jamendo**: mirdata supports only the autotagging moodtheme split (tags). No tempo or beat loader found — [mirdata datasets dir](https://github.com/mir-dataset-loaders/mirdata/tree/master/mirdata/datasets)
- **Slakh2100**:
  - Zenodo 4599666 has `slakh2100_flac_redux.tar.gz` (104.32 GB, `cc-by-4.0`) (VERIFIED) — [Zenodo](https://zenodo.org/records/4599666)
  - BabySlakh (Zenodo 4603870) has `babyslakh_16k.tar.gz` (883 MB) (VERIFIED) — [Zenodo](https://zenodo.org/records/4603870)
  - Per the README, each track has `all_src.mid` (the original Lakh MIDI), per-stem `MIDI/SXX.mid`, `mix.flac` (mono, 44.1 kHz) and `metadata.yaml`. It contains 2,100 tracks / 145 h (CLAIMED by the README; I did not list the tarball) — [slakh-utils README](https://github.com/ethman/slakh-utils)
  - HF mirrors exist, e.g. `DreamyWanderer/Slakh2100-FLAC-Redux-Reduced` and `projectlosangeles/Slakh2100` (contents not verified) — [HF search](https://huggingface.co/datasets?search=slakh)
- **Osu2MIR** (ISMIR 2025 LBD):
  - `osu2beat2025_metered_beats.zip` holds **741 files** named `<MD5>_<BeatmapSetID>_beats_metered.txt` in the format `time<TAB>beat_in_bar` (VERIFIED).
  - The README says to download the audio yourself from osu.ppy.sh beatmapsets and check the MD5.
  - The tag rows I sampled in `tables/*_info.csv` are vocaloid / anime / J-rock songs.
  - Source: [osu2mir repo](https://github.com/ziyunliu4444/osu2mir)
- **GTZAN**:
  - `marsyas/gtzan` on HF has `data/genres.tar.gz` (1.23 GB) (VERIFIED) — [HF](https://huggingface.co/datasets/marsyas/gtzan)
  - Beat annotations: `beat_this_annotations/gtzan/annotations/beats` has 999 files, from superbock/ISMIR2019 (VERIFIED). GTZAN has no split file in that repo, i.e. it is not part of the 8-fold training — [beat_this_annotations](https://github.com/CPJKU/beat_this_annotations)
- **Trap:** `DynamicSuperb/MARBLEBeatTracking_GTZAN-Rhythm` (HF) has 200 clips with audio, but its `label` is only **beat and downbeat counts** (e.g. `{'beat': 69, 'downbeat': 17}`), not times (VERIFIED via datasets-server) — [HF](https://huggingface.co/datasets/DynamicSuperb/MARBLEBeatTracking_GTZAN-Rhythm)
- **HF Hub keyword search** (VERIFIED): "beat", "ballroom", "downbeat", "beat tracking", "hainsworth", "bpm", "rhythm" and "tempo" returned no repo that bundles real audio with beat times, apart from the Harmonix BigVGAN repo above — [HF datasets search](https://huggingface.co/datasets?search=harmonix)

### Inferences
- **Slakh**:
  - Beats from `pretty_midi.get_beats()` / `get_downbeats()` on `all_src.mid` are sample-exact relative to the render.
  - Lakh MIDI tempo maps are sometimes unmusical (e.g. no tempo map, or a free-time performance). Filter by constant time signature and plausible BPM.
  - Possible overlap with TempoCNN's LMD tempo training: it shares Lakh/MSD song identities, but the audio differs.
- Mixing Secrets / Cambridge-MT: no beat-annotated release found (gap, not verified absence).

### Gaps
- Not verified:
  - Kaggle-hosted copies of RWC 2.0, Slakh, or Harmonix BigVGAN (Kaggle search needs auth and was not done). Kaggle notebooks can pull from Zenodo or HF directly, which covers this.
  - Whether osu! downloads require login (believed yes).
  - The contents of the HF Slakh mirrors.

## Summary table

| Candidate | Audio (free?) | Labels | Pop/rock full-length | Size | Trained on by | Status |
|---|---|---|---|---|---|---|
| **RWC-G 2.0** (Zenodo 18656623 + rwc-music/rwc-annotations) | Real WAV, CC BY-NC 4.0 | beats + downbeats, tempo in metadata | 12 pop/rock + 15 dance/R&B, full | RWC-G.zip 3.9 GB | none of the listed models (Beat This! uses only P/R/J/C) | VERIFIED |
| **RWC-P 2.0** | Real WAV, CC BY-NC 4.0 | beats + downbeats | 100 J-pop/US-style pop, full | 4.1 GB | Beat This!, madmom (not BeatNet) | VERIFIED (zip not opened) |
| **Harmonix BigVGAN** (HF m-a-p) | Vocoded WAV, 22.05 kHz mono, no license | official beats + downbeats (urinieto) or Beat This! corrected set | 912 Western pop, full | 8.5 GB | Beat This! | VERIFIED |
| Harmonix via YouTube | 863/912 oEmbed-live; copyrighted | same | full, but misaligned (30–40% pre-processed) | — | Beat This! | VERIFIED (liveness) |
| Slakh2100 / BabySlakh | Synthesized FLAC, CC BY 4.0 | derive from MIDI | Lakh pop/rock, full | 104 GB / 0.9 GB | none (TempoCNN: related LMD) | VERIFIED files; contents CLAIMED |
| Osu2MIR | must fetch from osu!, copyrighted | 741 metered beat files | mostly anime/J-pop/vocaloid, full | — | none | labels VERIFIED |
| GTZAN | HF marsyas/gtzan | beats + downbeats (ISMIR2019) | 30 s clips | 1.2 GB | BeatNet (some models); Beat This! test only | VERIFIED |
| FMA (tempo_eval) | CC audio | **genre only**; tempo = estimates | full only in fma_full | 879 GiB | — | VERIFIED (no ground truth) |
| MUSDB18 beats | audio yes | **none released** | — | — | BeatNet+ | VERIFIED absent |
| DALI / MedleyDB / MTG-Jamendo | yes / yes / yes | no beats or tempo | — | — | — | VERIFIED (README / sample) |
