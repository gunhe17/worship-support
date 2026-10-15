# Synthetic / MIDI-rendered datasets with exact beat & tempo ground truth (verified Oct 2026)

Scope: free datasets whose beat/tempo truth comes exactly from symbolic data (MIDI tempo map plus time signature) or from a near-exact proxy, for evaluating 14 beat/tempo trackers (Beat This!, madmom, BeatNet, librosa, Essentia, DeepRhythm, TempoCNN, all-in-one, ...) on band-style pop/rock, including tempo changes.

Labels used below:
- **VERIFIED** means I checked it directly: the file listing came from the Zenodo, GitHub or Hugging Face API, an HTTP HEAD returned the size, or I downloaded and parsed the files.
- **CLAIMED** means it comes from a dataset page or paper and I did not inspect it myself.

Check date: 2026-10-13.

---

## 1. Slakh2100 / Slakh2100-redux / BabySlakh / Slakh2100-16k

### Takeaway
Slakh is the best fit. It has 2,100 full-length, band-style tracks (always piano, guitar, bass and drums), rendered from Lakh MIDI. The rendering MIDI ships with every track, CC BY 4.0. I parsed all 2,100 MIDI files myself:
- 637 tracks (30%) contain tempo changes.
- 598 of those have a max/min BPM ratio above 1.04.
- 147 have 20 or more tempo events (ramps or ritardandos).
- 1,852 start in 4/4.

The main caveats are synthetic timbre, no vocals, and a MIDI grid that is not always musically meaningful (some Lakh MIDI files are unquantized or have odd tempo events). The official archive is 104 GB, but a 16 GB mix-only 16 kHz WAV mirror on Hugging Face plus a 37 MB MIDI-only tarball make it Kaggle-feasible.

### Cited Findings
- **VERIFIED (Zenodo API, record 4599666).** Title "Slakh2100".
  - License `cc-by-4.0`.
  - Exactly one file: `slakh2100_flac_redux.tar.gz`, 104.323 GB.
  - Zenodo page: mono FLAC, rendered at 44.1 kHz / 16-bit; 2,100 tracks; 187 patches in 34 classes; about 145 h of mixtures; at least one piano, guitar, drums and bass per mix; nearly 500 GB once converted to WAV.
  - Redux release moves duplicated-MIDI tracks into `omitted/`.
  - [Zenodo 4599666](https://zenodo.org/records/4599666)
- **VERIFIED (Zenodo API, record 4603870).** "BabySlakh", `cc-by-4.0`, one file `babyslakh_16k.tar.gz` of 0.883 GB.
  - Streaming the tarball showed folders `Track00001`–`Track00020`. Each has `mix.wav` (about 11 MB, 16 kHz WAV), `stems/`, `MIDI/` and `metadata.yaml`.
  - [Zenodo 4603870](https://zenodo.org/records/4603870)
  - Zenodo served only about 100 KB/s to this machine, so I listed the archive partially and did not finish the full download.
- **VERIFIED (Zenodo API, record 7708270).** "Slakh2100-16k", `cc-by-4.0`, one file `slakh2100_redux_16k.tar.gz` of 48.689 GB, published 2023-03-08. [Zenodo 7708270](https://zenodo.org/records/7708270)
- **VERIFIED (Hugging Face API, `projectlosangeles/Slakh2100`, not gated).** Files:
  - `slakh2100_16kHz_wav_redux_mix_only.tar.gz` — 16.301 GB
  - `slakh2100_16kHz_sf2_wav_redux_mix_only.tar.gz` — 29.155 GB (an SF2 re-render variant)
  - `slakh2100_flac_redux.tar.gz` — 104.323 GB
  - `slakh2100_redux-mix_midis_only.tar.gz` — 0.037 GB
  - `slakh2100_redux_songformer_annotations.zip`
  - The card states license `cc-by-nc-sa-4.0`, which conflicts with the original CC BY 4.0. Cite the original Zenodo record.
  - [HF projectlosangeles/Slakh2100](https://huggingface.co/datasets/projectlosangeles/Slakh2100)
- **VERIFIED (downloaded and parsed).** The HF MIDI-only tarball holds 2,100 `all_src.mid` files: train 1,289, validation 270, test 151, omitted 390. I parsed them with mido (script in session scratchpad).
  - Duration: min 35 s, median 239 s, max 2,419 s, 146.8 h in total. These are full-length songs, not excerpts.
  - Distinct tempo values per file: 1 → 1,463 files; 2 → 120; 3 → 62; 4 → 46; 5 → 38; 6–9 → 118; 10 or more → 253.
  - 598 files have max/min BPM above 1.04, and 147 files have 20 or more distinct tempo events.
  - Time signature at the start: 4/4 in 1,852 files; no time-signature event (defaults to 4/4) in 131; 2/4 in 31; 6/8 in 21; 3/4 in 13; 6/4 in 12; 12/8 in 12.
  - 474 files have more than one time-signature segment.
  - Initial BPM: 5th percentile 65, median 108, 95th percentile 156.
  - Examples:
    - Track00049: tempo steps down 101 → 100 → 98 → ... → 91, an ending ritardando.
    - Track00170: tempos 70 → 69.5 → 28 → 64. A spurious-looking 28 BPM event, so the MIDI grid is not always a perceptual beat grid.
    - Track00240: tempo ramp 71 → 64 while the time signature alternates 4/4 ↔ 2/4.
  - Source: the parsed MIDI from [HF projectlosangeles/Slakh2100](https://huggingface.co/datasets/projectlosangeles/Slakh2100)
- **VERIFIED (slakh-utils README).** Each track contains `all_src.mid` (an original Lakh MIDI with all sources), `MIDI/SXX.mid` per stem and `metadata.yaml`.
  - The per-stem `SXX.mid` "is the exact file used to synthesize SXX.flac". The `all_src.mid` entry is a direct copy from Lakh, and the two "not guaranteed to match" because of instrument heuristics.
  - `metadata.yaml` has `lmd_midi_dir`, a path into `lmd_matched/` that ties each track to an MSD ID.
  - Split sizes in the original release were 1,500 / 375 / 225.
  - [ethman/slakh-utils](https://github.com/ethman/slakh-utils)
- **VERIFIED (source code).** pretty_midi `get_beats()` returns "beat locations, according to MIDI tempo changes", treating compound meters as every third denominator note. `get_downbeats()` uses "MIDI tempo changes and time signature change events". [pretty_midi source](https://github.com/craffel/pretty-midi/blob/main/pretty_midi/pretty_midi.py)
- **CLAIMED.** The Slakh paper describes it as rendered with "professional-grade sample-based virtual instruments" and "purely instrumental". [arXiv 1909.08494](https://arxiv.org/abs/1909.08494)
- **CLAIMED.** A 2026 paper, "Silent Metronome", uses Slakh2100 because "the tempo map and time signature of every track are known exactly". It also notes "note timing follows the source MIDI files, largely but not universally quantized to this grid", and it uses Beat This! plus madmom BeatEvaluation. [arXiv 2609.07688](https://arxiv.org/html/2609.07688)
- **CLAIMED.** SyncTrack (2026) evaluates beat tracking on Slakh2100 using madmom processors; it does not describe how its reference beats were built. [arXiv 2603.01101](https://arxiv.org/pdf/2603.01101)

### Inferences
- **Beat and downbeat ground truth.** Take each stem's `SXX.mid`, or `all_src.mid`, and run `pretty_midi.get_beats()` / `get_downbeats()`. The tempo map is identical across stems in practice, but verify on a few tracks. This gives exact sample-aligned truth, since the audio was rendered from these files. A render offset (for example, sampler attack latency) is plausible but unverified; measure it on a few tracks by onset-to-note cross-correlation.
- **Recommended filtering:**
  - Drop files whose tempo map has implausible events (BPM below 40 or above 250, or more than 30% jumps that return immediately).
  - Drop files whose note onsets are mostly off the 16th-note grid; these are unquantized "played-in" MIDI, where the tempo map does not describe the real pulse.
  - Optionally restrict to 4/4 with 1 to 5 tempo segments to get a clean "tempo-change" subset of a few hundred songs.
- **Realism concerns:**
  - Synthetic sample-library timbre and automatic mixing; no vocals, no live drummer feel.
  - Tempo changes are mostly step changes from MIDI authors, and ritardandos at endings. These are not the gradual push or pull of a live band.
  - This makes Slakh a good test of whether a tracker follows tempo-map changes, but not a stand-in for live worship-band recordings.
- **Kaggle feasibility:** The 16 GB mix-only WAV (HF) plus the 37 MB MIDI fit Kaggle's 20 GB `/kaggle/working`, or larger temp disk, if streamed and extracted selectively. Avoid the 104 GB FLAC. Hugging Face downloads were fast in testing (37 MB in seconds); Zenodo was about 100 KB/s here.
- **Leakage:** None of the trackers' documented training sets include Slakh (see section 8). Song-identity overlap with TempoCNN is possible, because Slakh comes from `lmd_matched`, which links to the MSD 7digital previews used in LMD Tempo. That overlap is different audio of the same song.

### Gaps
- I could not verify the time offset between rendered audio and MIDI, the loudness normalization, or whether the HF 16 kHz mix-only tarball contains exactly the redux tracks with MIDI-aligned audio. I did not download the 16 GB file.
- The grid-alignment check (fraction of onsets on the 16th-note grid) is reported in the addendum at the end if it finished. Otherwise it was not completed.
- I found no genre labels inside Slakh. Genre must come from MSD/Lakh metadata via `lmd_midi_dir`.

---

## 2. Lakh MIDI Dataset (LMD) and the MSD 7digital previews, LMD Tempo

### Takeaway
The LMD MIDI files are freely downloadable (VERIFIED by HTTP HEAD), but **no audio is distributed**. The 7digital preview API is dead, so LMD-aligned is only useful as MIDI to render yourself. LMD Tempo (3,611 7digital previews) is in TempoCNN's training set, so any LMD-derived audio of those songs is a potential leak for TempoCNN/Essentia TempoCNN.

### Cited Findings
- **VERIFIED (HTTP HEAD on hog.ee.columbia.edu/craffel/lmd/):**
  - `lmd_full.tar.gz` — 1.768 GB
  - `lmd_matched.tar.gz` — 1.407 GB
  - `lmd_aligned.tar.gz` — 0.272 GB
  - `match_scores.json` — 7.2 MB
  - All four returned HTTP 200.
  - [LMD page](https://colinraffel.com/projects/lmd/)
- **CLAIMED.**
  - LMD-full has 176,581 MIDI files; LMD-matched has 45,129 matched to MSD; LMD-aligned is aligned to 7digital preview MP3s.
  - License CC BY 4.0.
  - Audio previews are not distributed; the page says to contact the author.
  - The page says MIDI can provide "meter information such as beats and downbeats".
  - [LMD page](https://colinraffel.com/projects/lmd/)
- **CLAIMED.** The 7digital API was deactivated, and "only two organizations" are assumed to have scraped the MSD previews comprehensively. [The Biased Journey of MSD_AUDIO.ZIP, arXiv 2308.16389](https://arxiv.org/pdf/2308.16389)
- **VERIFIED (read the PDF text).** TempoCNN (Schreiber and Müller, ISMIR 2018) was trained on "LMD Tempo, MTG Tempo, and EBall".
  - LMD Tempo was built by estimating the tempo of the matched audio previews and keeping a preview "if the value of more than half the tempo messages ... were within 2% of the estimated tempo".
  - It contains 3,611 tracks: 29% rock, 27% pop.
  - [ISMIR 2018 paper 141](https://ismir2018.ismir.net/doc/pdfs/141_Paper.pdf)
- **VERIFIED.** The tempo-cnn repository is licensed AGPL-3.0, and its README does not list training data. [hendriks73/tempo-cnn](https://github.com/hendriks73/tempo-cnn)

### Inferences
- Using LMD MIDI + 7digital audio in 2026 is not practical (no audio). Rendering LMD MIDI yourself is possible, but Slakh already did that with better instruments.
- **TempoCNN leakage (also Essentia's TempoCNN models, which are based on it):** It trained on real audio previews of about 3.6k LMD songs. Slakh renders different audio of possibly the same songs. This is a weak leak (same composition and tempo, different timbre), but it could still bias TempoCNN on overlapping songs.
- **Mitigation:** Map Slakh `lmd_midi_dir` → MSD ID, and exclude any track whose MSD ID is in LMD Tempo. The LMD Tempo ID list must be obtained from Schreiber's published ground truth.

### Gaps
- I did not locate or verify the published LMD Tempo ID list, so the actual Slakh ∩ LMD Tempo overlap count is unknown.

---

## 3. Groove MIDI Dataset (GMD) and Expanded Groove (E-GMD) — drums only

### Takeaway
Both have real drummer performances recorded to a click, with an integer `bpm` per file, synthesized audio, and CC BY 4.0. They are drums only, and GMD is in **Beat This!'s training set**, so it is not a fair test for Beat This!. They are useful only as a drum-only sanity check for the other trackers.

### Cited Findings
- **VERIFIED (HTTP HEAD on storage.googleapis.com/magentadata):**
  - `groove-v1.0.0.zip` — 5.11 GB
  - `groove-v1.0.0-midionly.zip` — 3.26 MB
  - `e-gmd-v1.0.0.zip` — 96.42 GB
  - All three returned HTTP 200.
- **CLAIMED (Magenta GMD page):**
  - 1,150 MIDI files, about 13.6 h.
  - WAV synthesized from a Roland TD-11, aligned within 2 ms.
  - Played with a metronome at the `bpm` integer.
  - Metadata `info.csv` has columns drummer, session, id, style, bpm, beat_type (beat/fill), time_signature, midi_filename, audio_filename, duration, split.
  - Mostly 4/4.
  - [Magenta Groove](https://magenta.withgoogle.com/datasets/groove)
- **CLAIMED (Magenta E-GMD page):**
  - 444 h of audio from 43 kits (Roland TD-17), WAV 44.1 kHz / 24-bit, aligned within 2 ms.
  - Integer BPM per performance; CC BY 4.0.
  - About 90 GB zipped / 132 GB unzipped.
  - [Magenta E-GMD](https://magenta.withgoogle.com/datasets/e-gmd)
- **VERIFIED.** The Beat This! training spectrogram set on Zenodo includes `groove_midi.zip` (8.793 GB). [Zenodo 13922116](https://zenodo.org/records/13922116)

### Inferences
- These are human performances to a click, so tempo is constant per file. They have no tempo changes and are not useful for tempo-change evaluation.
- The beat grid is the click (from the MIDI tempo), not exact note positions, because the drummer plays with human timing.
- E-GMD is too big for Kaggle (96 GB). GMD (5 GB) is feasible.

### Gaps
- I did not open `info.csv` to confirm the distribution of BPM and time signatures.

---

## 4. POP909

### Takeaway
**No audio** (VERIFIED). It is MIDI piano arrangements of 909 Chinese pop songs with beat files extracted from the original audio, which is not distributed. It is usable only if you render the MIDI yourself, and then the result is piano-only.

### Cited Findings
- **VERIFIED (GitHub tree API, music-x-lab/POP909-Dataset):**
  - 9,270 entries: 4,545 `.txt`, 2,898 `.mid`, 2 `.zip`, 1 `.xlsx`.
  - No audio files of any kind (no wav, mp3 or flac).
  - Per song: `NNN.mid`, `beat_audio.txt`, `beat_midi.txt`, `chord_audio.txt`, `chord_midi.txt`, `key_audio.txt`, `versions/*.mid`.
  - `POP909.zip` is 22.96 MB.
  - [GitHub POP909](https://github.com/music-x-lab/POP909-Dataset)
- **VERIFIED.** README: "beat_audio/beat_midi.txt: the extracted beat information from the raw audio/midi, the first column is the time (in sec)". The MIDI has MELODY, BRIDGE and PIANO tracks. A sample `beat_midi.txt` line reads `0.0553 1.0 1.0`. [POP909 README](https://github.com/music-x-lab/POP909-Dataset)

### Inferences
- POP909 is not an audio benchmark. Rendering it gives piano-only pop with tempo curves that came from the original performances' beat tracking. That would be a "variable tempo, single instrument" test, which is not band-like.

### Gaps
- License: the repository has a `LICENSE` file (1,068 bytes, probably MIT), which I did not read.

---

## 5. MAESTRO / ASAP (piano, classical)

### Takeaway
ASAP **does not distribute audio** (VERIFIED from its README statement). Audio comes from MAESTRO v2 (519 performances). It is in Beat This!'s training set. It is classical piano, so it is irrelevant for band pop/rock and only notable as a tempo-variation reference.

### Cited Findings
- **CLAIMED.** "The audio files are not distributed in this repository"; 519 performances have audio via MAESTRO v2.0.0 and `initialize_dataset.py`. Annotations cover beats, downbeats, time-signature changes and key changes. License CC BY-NC-SA 4.0. [ASAP GitHub](https://github.com/fosfrancesco/asap-dataset)
- **VERIFIED.** Beat This! training includes `asap.zip` (32.907 GB of spectrograms). [Zenodo 13922116](https://zenodo.org/records/13922116)

### Inferences
- Exclude it for the band pop/rock goal and for Beat This! fairness.

### Gaps
- I did not verify the MAESTRO download size this session.

---

## 6. Render-it-yourself: hymn / worship MIDI (hymnary.org, CCEL, Open Hymnal)

### Takeaway
Public-domain hymn MIDI exists. CCEL's Ethereal Hymnary has an explicit "free to use in any manner" statement. Hymnary.org's MIDI pages could not be fetched (404 on the tested URL). Hymnary.org forum users report its MIDIs are single-verse basic 4-part harmony. I could not reach the Open Hymnal license at all.

Rendering these with FluidSynth or DawDreamer yields organ/piano 4-part hymns, not band-style worship. Tempo changes and key-ups would have to be **authored by us**, for example by editing tempo maps and repeating verses with a transposition. That is feasible because the ground truth is whatever tempo map we write.

### Cited Findings
- **CLAIMED.** CCEH (Christian Classics Ethereal Hymnary) states its files, including MIDIs, are public domain or freely released and are "free to use in any manner ... no cost, obligation or limitations on these rights". [CCEL copyright page](https://ccel.org/cceh/cceh_cpr.htm)
- **CLAIMED.** A hymnary.org forum user reports the MIDI files "seem only to have a single verse of the basic harmony". Hymnary.org staff point users to free Small Church Music MP3 recordings. [hymnary.org comment](https://hymnary.org/comment/42411)
- **CLAIMED.** Small Church Music lists about 14,891 public-domain MP3s that are free to download. These are real, not MIDI-rendered, recordings, so they have no exact ground truth. [smallchurchmusic.com](https://www.smallchurchmusic.com/Score_List-New.php?LT=H)
- **Not verified:** `https://hymnary.org/tune/old_hundredth_genevan` returned 404 to WebFetch. The hymnary FAQ URL also returned 404. The Open Hymnal license was not found in search.

### Inferences
- The most controllable path is to write our own MIDI arrangements: drums, bass, guitar and keys in a worship-band style over public-domain hymn melodies. Then render them with Slakh-like sample libraries or SoundFonts via FluidSynth/DawDreamer, with authored tempo ramps, fermatas and key-up modulations.
- The ground truth is exact by construction. Realism is the limiting factor, the same as Slakh but worse with GM SoundFonts.
- CCM/CCLI songs are copyrighted; do not render them for a shared dataset.

### Gaps
- I did not verify the count, format or download mechanism of CCEL MIDIs, the current hymnary.org MIDI download policy, or the Open Hymnal license.

---

## 7. Real-audio tempo-change labels: Osu2MIR (and Taiko-derived sets)

### Takeaway
The Osu2MIR repository (VERIFIED) contains only **annotations and tables, no audio**:
- `osu2beat2025_metered_beats.zip` (1.39 MB): 741 annotations for 708 audios, keyed by MP3 MD5 plus BeatmapSetID.
- CSV tables, including `geq5_info.csv` with 741 rows (songs with multiple uninherited timing points, at least 5 s apart).

Audio must be fetched as `.osz` from osu.ppy.sh, which requires a logged-in account. The labels are human-made, not exact; the authors describe the ≥5 s subset as reliable. Genres lean anime, Vocaloid and J-rock.

### Cited Findings
- **VERIFIED (GitHub tree API, ziyunliu4444/osu2mir):** 20 entries:
  - `421_lbd.pdf`, `README.md`
  - `additional_tools/{extract_uninherited_timing_points,madmom_evaluation,self_track_madmom,song_info_csv}.py`
  - `data_conversion.py`, `data_partition.py`
  - `osu2beat2025_metered_beats.zip` (1,393,741 bytes)
  - `tables/{geq5,le5,single}_{extreme,f_cmlt_amlt,info}.csv`
  - No audio. [osu2mir GitHub](https://github.com/ziyunliu4444/osu2mir)
- **VERIFIED (README):**
  - The zip "contains the metered beats of the second subset ... covering 741 user annotations for 708 distinct audios", named `<MD5>_<BeatmapSetID>_beats_metered.txt`.
  - "We do not own the copyright of the audio files, so you need to download the audio files by yourself": download the beatmap from osu.ppy.sh, extract the `.osz`, check the MD5.
  - Single timing point and ≥5 s-apart subsets "should have high quality"; use the <5 s subset with caution.
  - [osu2mir README](https://github.com/ziyunliu4444/osu2mir)
- **VERIFIED.** `tables/geq5_info.csv` has 741 data rows with columns title, artist, creator, tags, num_timing_points, num_uninherited_points, mp3_duration_seconds, song_name, variation_rating_uninherited. Example tags include "japanese rock", "vocaloid" and "anime". [geq5_info.csv](https://github.com/ziyunliu4444/osu2mir/blob/main/tables/geq5_info.csv)
- **CLAIMED.** Paper: ISMIR 2025 LBD. The ≥5 s criterion separates reliable from curation-needed beatmaps, with high consistency across multiple annotations of the same song. The genres are underrepresented ones such as anime, Vocaloid and video-game music. [arXiv 2509.12667](https://arxiv.org/abs/2509.12667)
- **CLAIMED (community sources, older).** osu.ppy.sh will not serve beatmap downloads without login; scripted access needs a session cookie, and third-party mirrors exist. [Archive Team osu! wiki](https://archiveteam.org/index.php/Osu!); [osu-beatmap-downloader](https://github.com/vincentmathis/osu-beatmap-downloader)
- **VERIFIED (HF API search).** JacobLinCool's `taiko-2023-*` datasets exist on Hugging Face; they are rhythm-game-chart derived. I did not inspect their files. [HF JacobLinCool](https://huggingface.co/JacobLinCool/exp-beat-tracking-task/blob/main/README.md)

### Inferences
- Osu2MIR is the only candidate here with **real recordings plus tempo-change labels**, but it fails "exact": labels are user-made timing points.
- The audio is copyrighted, so it cannot be redistributed. Kaggle access would need a login cookie inside the notebook, which is fragile and against site terms, so it is not Kaggle-friendly.
- Its genre mix (J-rock, anime) is band-adjacent, but it skews toward electronic and Vocaloid music.
- Leakage: no known tracker was trained on osu data, except possibly the 2022 self-supervised metrical work. That work is cited only as "Lakh (MIDI) or osu (audio)" labels, so unclear. [arXiv 2210.17183](https://arxiv.org/pdf/2210.17183)

### Gaps
- I did not verify the current osu! site login requirement from an official osu! page; the wiki URL returned 404.
- The per-subset counts for the `single` and `le5` tables were not computed.

---

## 8. Training-set leakage per tracker (for choosing synthetic sets)

### Takeaway
No tracker in scope documents training on Slakh. Beat This! trained on Groove MIDI, GuitarSet, ASAP, Harmonix, Beatles, RWC and others. all-in-one trained on Harmonix. BeatNet trained on Ballroom, Beatles, Carnatic and Rock Corpus (GTZAN was the test set). madmom's downbeat model trained on Ballroom, Beatles, Hainsworth, HJDB, RWC Popular, Robbie Williams, Rock, Carnatic, Cretan and Turkish. TempoCNN trained on LMD Tempo, MTG Tempo and EBall. DeepRhythm's training data is undisclosed. librosa and Essentia's DSP trackers are untrained.

### Cited Findings
- **VERIFIED (Zenodo API 13922116, "Beat This! Spectrograms").** Files: gtzan, beat_this_annotations, asap, guitarset, candombe, ballroom, beatles, filosax, hainsworth, groove_midi, harmonix, hjdb, rwc, smc, simac, jaah, tapcorrect.
  - The README says `final*`/`small*` models were "trained on all data except the GTZAN dataset", and "an evaluation with final* or small* can only be performed fairly on GTZAN or other datasets we didn't consider in our paper".
  - [Zenodo 13922116](https://zenodo.org/records/13922116); [beat_this README](https://github.com/CPJKU/beat_this)
- **VERIFIED (README).** all-in-one: "The models are trained on the Harmonix Set with 8-fold cross-validation"; the default is `harmonix-all`. [all-in-one](https://github.com/mir-aidj/all-in-one)
- **VERIFIED (PDF text, Table 1).** BeatNet lists Ballroom (685), Beatles (180), Carnatic (176), GTZAN (999) and Rock Corpus (200). GTZAN was "unseen during training"; Ballroom and Rock were set aside for some generalization experiments. [BeatNet arXiv 2108.03576](https://arxiv.org/pdf/2108.03576)
- **VERIFIED (PDF text, Table 1).** madmom downbeat (Böck, Krebs and Widmer, ISMIR 2016) trained on Ballroom, Beatles, Hainsworth, HJDB, RWC Popular, Robbie Williams, Rock, Carnatic, Cretan and Turkish. GTZAN, Klapuri and SMC were held out. [ISMIR 2016 paper](https://archives.ismir.net/ismir2016/paper/000186.pdf)
- **VERIFIED (PDF text).** TempoCNN training = LMD Tempo (3,611) + MTG Tempo (1,159) + EBall (3,826; Extended Ballroom minus Ballroom). [ISMIR 2018](https://ismir2018.ismir.net/doc/pdfs/141_Paper.pdf)
- **VERIFIED (README).** DeepRhythm reports a test on "953 songs, mostly Electronic, Hip Hop, Pop, and Rock" and does not name its training data. [bleugreen/deeprhythm](https://github.com/bleugreen/deeprhythm)

### Inferences
- **Slakh** is "clean" for all of them. The only exception is TempoCNN, which shares possible song identity through LMD.
- **GMD and ASAP** leak into Beat This!.
- madmom's beat-only RNN models (Böck 2014/2015) may have used different sets than the downbeat model. I did not verify this; treat madmom as trained on the union.

### Gaps
- madmom's `RNNBeatProcessor` training list, DeepRhythm's training data, and BeatNet's exact final-model training split were not confirmed.
- No 2023–2026 public synthetic tempo-change beat-tracking benchmark was found. Searches turned up only a 2021 tempo-scaled Groove MIDI study ([arXiv 2102.02282](https://arxiv.org/pdf/2102.02282)) and real-audio studies.
- "TempoWarp" and similar names were not found.
