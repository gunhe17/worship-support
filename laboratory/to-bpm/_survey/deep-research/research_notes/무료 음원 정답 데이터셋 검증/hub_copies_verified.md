# Hub copies of beat/tempo/downbeat evaluation datasets (audio + labels), checked 2026-10-13

How I checked: I ran the public APIs from this machine on 2026-10-13. The Kaggle file list came from `https://www.kaggle.com/api/v1/datasets/list/{owner}/{slug}`, which works without logging in. The HF file tree came from `/api/datasets/{id}/tree/main?recursive=true` and the column types from `datasets-server /info` and `/first-rows`. The Zenodo file list came from `/api/records/{id}` and the zip contents from `/files/{zip}/container`. I also read the central directory of one HF zip with HTTP range requests, and sent HEAD requests to each download URL.
- **VERIFIED** means I saw the file list or schema myself (and the sample rows or HTTP 200 where noted).
- **CLAIMED** means it comes from a README or a paper, or it is the known contents of the original dataset, and I did not open it.
- The Kaggle CLI on this machine has no token. Kaggle search used the public `datasets/list?search=` endpoint, which only matches titles and is incomplete.

## Q1. Which hub copies have REAL AUDIO + beat/tempo labels together (file lists checked)?

### Takeaway
Only a few copies can be opened in a Kaggle notebook today with both audio and labels. Ranked:
1. **RWC Popular.** The official open re-release (Zenodo, CC BY-NC, Feb 2026) plus the official annotation repo on GitHub. A third-party HF parquet bundle also exists.
2. **GTZAN + GTZAN-Rhythm** on HF `m-a-p/GTZAN`. It has wav files and the Marchand/Peeters beat and downbeat JAMS.
3. **GuitarSet** on Kaggle `alonhaviv/guitarset` and HF `jhartquist/guitarset`.
4. **Ballroom.** The official MTG URL still works and annotations come from CPJKU's GitHub. This is a single wget, or `mirdata`.

I found no hub copy with real audio for **SMC, Hainsworth, HJDB, Simac, Beatles, ACM Mirum, ISMIR04-songs, Rock Corpus or TapCorrect**. Harmonix exists only as annotations, or as BigVGAN-resynthesized audio.

### Cited Findings

**Tier A: can start today (audio + labels in one place, or two official URLs that both work)**

- **RWC Music Database, official audio, VERIFIED.** Zenodo record 18656623, "RWC Music Database", published 2026-02-16, license cc-by-nc-4.0, open access. Creators: Goto, Balke, Müller.
  - Files: `RWC-P.zip` 4071.8 MB, `RWC-J.zip` 2127.8 MB, `RWC-C.zip`, `RWC-G.zip`, `RWC-R.zip`, `changelog.txt`.
  - The `RWC-P.zip` container lists `RWC-P/RWC_P0xx.wav` files (about 35–51 MB each).
  - The description says the repository holds "audio data only". Annotations are kept separately at github.com/rwc-music/rwc-annotations.
  - Source: [Zenodo 18656623](https://zenodo.org/records/18656623)
- **RWC annotations, VERIFIED.** The repo `rwc-music/rwc-annotations` (pushed 2026-06-26, LICENSE is CC BY-NC 4.0) has:
  - `01_annotations_preprocessed/beats/RWC-P/` with 100 csv files (also RWC-G 102, RWC-C 61, RWC-J 50, RWC-R 15).
  - The file format is `t;beat`, for example `0.060;1`, `0.510;2`. The second column is the position in the bar, so 1 marks a downbeat.
  - The README says the files are based on AIST annotations, merged in 2025/10 with CPJKU `beat_this_annotations/rwc` and quality-checked per track by sonification.
  - mirdata `rwc_popular` index 2.0 now pulls from both of these URLs. RWC-P.zip returned HTTP 200 with content-length 4071840278.
  - Sources: [rwc-annotations](https://github.com/rwc-music/rwc-annotations), [beats README](https://github.com/rwc-music/rwc-annotations/blob/main/01_annotations_preprocessed/beats/README.md), [mirdata rwc_popular.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/rwc_popular.py)
- **RWC-Pop third-party bundle, VERIFIED.** HF `taohu/rwc-pop` (third party, no license tag, modified 2026-02-20):
  - 9 parquet files, 4.24 GB, 100 rows.
  - Columns: `track_id, subset, title, artist, genre_main, genre_sub, tempo, audio(44.1 kHz), chords, beats, num_chords, num_beats`.
  - Sample row: `RWC_P001`, tempo `135.0`, beats `[{"time":0.06,"beat":1},{"time":0.51,"beat":2},...]`.
  - Which annotation version it uses is not stated. The first beat times match the rwc-annotations csv for P001 exactly (0.060, 0.510, 0.950).
  - Source: [HF taohu/rwc-pop](https://huggingface.co/datasets/taohu/rwc-pop)
- **GTZAN audio + GTZAN-Rhythm v2, VERIFIED.** HF `m-a-p/GTZAN` (license tag cc-by-4.0, from the Multimodal Art Projection group that made MARBLE; modified 2025-06-01):
  - 3019 files, 2.65 GB: 1000 `.wav` under `genres/`, plus `GTZAN-Rhythm_v2_ismir2015_lbd/` with 1000 `.jams` and 1000 `.xml`, `stats.csv`, `GTZANindex.txt`, `README.txt`.
  - Also includes the original tarball (1.18 MB), MARBLE `GTZANBeatTracking.{train,val,test}.jsonl`, and a copy of the Kaggle zip `gtzan-dataset-music-genre-classification.zip` (1.30 GB).
  - Sample `rock.00010.wav.jams` holds two `beat` namespaces by annotator "Ugo Marchand & Quentin Fresnel": 42 beats and 11 downbeats in 30 s.
  - The README says `stats.csv` has tempo, swing and meter per track.
  - Source: [HF m-a-p/GTZAN](https://huggingface.co/datasets/m-a-p/GTZAN)
- **GTZAN `jazz.00054.wav` is truncated, VERIFIED by size.** It is 1,207,592 bytes in both `m-a-p/GTZAN` and Kaggle `andradaolteanu/...`, while the other files are about 1.32 MB. It is widely reported as unreadable, but I did not test-load it. Skip or try/except it.
  - Sources: [HF tree](https://huggingface.co/api/datasets/m-a-p/GTZAN/tree/main/genres/jazz), [Kaggle file list](https://www.kaggle.com/datasets/andradaolteanu/gtzan-dataset-music-genre-classification)
- **GTZAN audio-only Kaggle copies, VERIFIED** (pair them with GTZAN-Rhythm annotations from m-a-p/GTZAN, or with mirdata's `TempoBeatDownbeat/gtzan_tempo_beat` GitHub zip):
  - `andradaolteanu/gtzan-dataset-music-genre-classification`: 1000 wav, 999 png, 2 csv, 1.41 GB.
  - `carlthome/gtzan-genre-collection`: 1000 `.au` (the original format), 1.32 GB.
  - `achgls/gtzan-music-genre`: 1000 wav, 1000 png, 1.79 GB.
  - `avenjoe/gtzan-dataset`, `murataktan/gtzan-fixed`: copies of andradaolteanu.
  - Sources: [andradaolteanu](https://www.kaggle.com/datasets/andradaolteanu/gtzan-dataset-music-genre-classification), [carlthome](https://www.kaggle.com/datasets/carlthome/gtzan-genre-collection), [mirdata gtzan_genre.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/gtzan_genre.py)
- **GuitarSet on Kaggle, VERIFIED.** `alonhaviv/guitarset` (CC BY 4.0): 1800 files, 14.11 GB, 1440 `.wav` and 360 `.jams` under `annotation/`, for example `00_BN1-129-Eb_comp.jams`. That the JAMS contain beat_position and tempo is CLAIMED from the original GuitarSet format; the HF copy below confirms beats exist.
  - Source: [Kaggle alonhaviv/guitarset](https://www.kaggle.com/datasets/alonhaviv/guitarset)
- **GuitarSet on HF, VERIFIED schema.** `jhartquist/guitarset` (cc-by-4.0, 18 parquet, 8.71 GB, 360 rows):
  - Columns include `tempo_bpm`, `beats_s` (list of float), 4 audio captures (`audio_mono_mic`, `audio_mono_pickup_mix`, hex pickup) and `chords`.
  - Built from GuitarSet v1.1.0 on Zenodo 3371780, with three note errata fixed.
  - `taohu/guitarset` (third party, 5 parquet, 1.86 GB) also has `tempo`, `beats`, `audio_mic`, `audio_mix`.
  - Sources: [HF jhartquist/guitarset](https://huggingface.co/datasets/jhartquist/guitarset), [HF taohu/guitarset](https://huggingface.co/datasets/taohu/guitarset)
- **Ballroom, official, VERIFIED reachable on 2026-10-13.**
  - Audio: `https://mtg.upf.edu/ismir2004/contest/tempoContest/data1.tar.gz`, HTTP 200, content-length 1,453,888,083.
  - Beats and downbeats: `https://github.com/CPJKU/BallroomAnnotations/archive/master.zip`, HTTP 200.
  - Both are mirdata `ballroom` remotes. No Kaggle or HF copy with audio was found; the Kaggle search hit `marcelrommel/modern-ballroom-dance-music-dataset` holds only `dataset.txt` and `download.py`.
  - Sources: [mirdata ballroom.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/ballroom.py), [Kaggle marcelrommel](https://www.kaggle.com/datasets/marcelrommel/modern-ballroom-dance-music-dataset)
- **BRID (Brazilian percussion), VERIFIED.** Zenodo 14051323 (cc-by-4.0): `audio.zip` 944.4 MB, HTTP 200, plus `annotations.zip` 0.1 MB. These are mirdata `brid` remotes.
  - Source: [Zenodo 14051323](https://zenodo.org/records/14051323)
- **Candombe, VERIFIED.** Zenodo 6533068 (cc-by-4.0): `candombe_audio.zip` 658.5 MB, HTTP 200, plus `candombe_annotations.zip` with beats and downbeats.
  - Source: [Zenodo 6533068](https://zenodo.org/records/6533068)

**Tier B: needs an extra step (download script, re-synthesis caveat, or annotation-only mirror)**

- **GiantSteps Tempo (664 Beatport previews, EDM), VERIFIED.**
  - mirdata `giantsteps_tempo` still says "audio files … are not available for download".
  - The repo's `audio_dl.sh` (v0.3, dated 2025-03-19) now uses `BASEURL=https://www.cp.jku.at/datasets/giantsteps/backup/`. A test file `5377710.LOFI.mp3` returned HTTP 200 audio/mpeg at 1.44 MB.
  - The old `geo-samples.beatport.com/lofi/` backup returns 404.
  - Annotations (original, plus Schreiber's new crowdsourced v2 on Zenodo 3553625) come from the GitHub zip.
  - The Kaggle copy `xvanlee/giantsteps-key` is the **Key** dataset (604 mp3 + `.key`/`.genre`/`.jams`), not the Tempo set. The track lists differ, so do not use it for tempo.
  - Sources: [audio_dl.sh](https://github.com/GiantSteps/giantsteps-tempo-dataset/blob/master/audio_dl.sh), [mirdata giantsteps_tempo.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/giantsteps_tempo.py), [Kaggle xvanlee/giantsteps-key](https://www.kaggle.com/datasets/xvanlee/giantsteps-key), [Zenodo 3553625](https://zenodo.org/records/3553625)
- **Harmonix Set, annotations only, VERIFIED.** HF `Archit00/harmonix-mirror` is an "unmodified mirror" of urinieto/harmonixset under CC BY 4.0: 10,068 files, 0.09 GB, `dataset/beats_and_downbeats/*.txt` (912 tracks), segments and `metadata.csv` with BPM. **No audio.** The official Dropbox mel-spectrogram tgz is still live (HTTP 200, 1.28 GB).
  - Sources: [HF Archit00/harmonix-mirror](https://huggingface.co/datasets/Archit00/harmonix-mirror), [harmonixset](https://github.com/urinieto/harmonixset)
- **Harmonix, BigVGAN-resynthesized audio, VERIFIED listing.** HF `m-a-p/harmonixset_bigvgan` (no license tag, modified 2025-08-21): `harmonixset_bigvgan.zip` 8.54 GB, whose central directory holds 912 `tracks/*.wav`, for example `0446_midnightcity.wav`. There is also a `harmonixset.corrected.20250821.jsonl` with structure labels and splits.
  - This is vocoded audio rebuilt from Harmonix mel spectrograms (my reading of the name). It is **not the original recordings**, so beat results may differ from real audio.
  - Source: [HF m-a-p/harmonixset_bigvgan](https://huggingface.co/datasets/m-a-p/harmonixset_bigvgan)
- **Groove MIDI, VERIFIED reachable.** `groove-v1.0.0.zip` returned HTTP 200 at 5.11 GB. It is drum-only and its beats come from MIDI. Low relevance.
  - Source: [mirdata groove_midi.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/groove_midi.py)
- **Salsa Dataset, VERIFIED.** Zenodo 13120822 (cc-by-4.0): `audio_fragments.zip` 322.6 MB, `beat_annotations.zip`, `songs and beat data.csv`, 124 salsa tracks. The description says full audio is only "if you get in touch", so the audio here is **fragments**.
  - Source: [Zenodo 13120822](https://zenodo.org/records/13120822)
- **Extended Ballroom, CLAIMED broken.** The IRCAM page is up and offers an annotations zip, v1.1 from 2016. The audio has to be scraped from ballroomdancers.com, and `www.ballroomdancers.com/Music/` returned HTTP 403.
  - Source: [IRCAM Extended Ballroom](http://anasynth.ircam.fr/home/media/ExtendedBallroom)

**Tier C: not usable (no audio, or labels too thin)**

- **Beat This! spectrograms, Zenodo 13922116, VERIFIED spectrograms only.** "Beat This! Spectrograms for Beat and Downbeat Tracking", cc-by-4.0, 141 GB.
  - Per-dataset zips: gtzan, asap, guitarset, candombe, ballroom, beatles, filosax, hainsworth, groove_midi, harmonix, hjdb, rwc, smc, simac.
  - `gtzan.zip` contains a single `gtzan.npz` (384 MB). `beat_this_annotations.zip` contains `.beats` text files.
  - No audio. The labels are usable as **annotations** to pair with audio from elsewhere.
  - Source: [Zenodo 13922116](https://zenodo.org/records/13922116)
- **Kaggle `juliohsu2/*`, VERIFIED.**
  - `selective-sampling-for-beat-tracking-evaluation` is one `smc.npz` (2.47 GB).
  - `guitarset-a-dataset-for-guitar-transcription` is one `guitarset.npz`.
  - `mp3array-dataset` is one parquet.
  - These are Beat This!-style spectrogram dumps, not audio.
  - Source: [Kaggle juliohsu2](https://www.kaggle.com/datasets/juliohsu2/selective-sampling-for-beat-tracking-evaluation)
- **HF `DynamicSuperb/MARBLEBeatTracking_GTZAN-Rhythm`, VERIFIED.** 200 test rows with audio, but `label` is only counts, for example `{'beat': 69, 'downbeat': 17}`. There are **no beat times**, so it is useless for F-measure. `DynamicSuperb/MusicBeatTracking_ASAP` (70 rows, piano) has the same instruction-style format.
  - Source: [HF DynamicSuperb GTZAN-Rhythm](https://huggingface.co/datasets/DynamicSuperb/MARBLEBeatTracking_GTZAN-Rhythm)
- **Kaggle `aneekaazmat/salami`, VERIFIED.** Annotations only (txt/npy). SALAMI is about structure, not beats.
  - Source: [Kaggle aneekaazmat/salami](https://www.kaggle.com/datasets/aneekaazmat/salami)
- **Kaggle `mattiaingrassia/gtzan-2-0`, VERIFIED.** 8000 png only.
  - Source: [Kaggle mattiaingrassia/gtzan-2-0](https://www.kaggle.com/datasets/mattiaingrassia/gtzan-2-0)
- **HF `marsyas/gtzan`, VERIFIED.** `data/genres.tar.gz` (1.23 GB) plus a loading script, with genre labels only.
  - Source: [HF marsyas/gtzan](https://huggingface.co/datasets/marsyas/gtzan)
- **Beatles (Isophonics), VERIFIED.** The annotation tarball is live (HTTP 200, 2.78 MB), but the audio is commercial CDs. No hub audio was found; Kaggle "beatles" hits are lyrics or Spotify metadata.
  - Source: [mirdata beatles.py](https://github.com/mir-dataset-loaders/mirdata/blob/master/mirdata/datasets/beatles.py)
- **SMC, VERIFIED unreachable.** The official page `smc.inesctec.pt/research/data-2/` gave a connection failure (curl 000) on 2026-10-13. No audio copy on Kaggle, HF or Zenodo; Kaggle has only the npz noted above.
- **Kaggle "tempo/bpm" hits, VERIFIED by title and size.** These are Spotify audio-feature tables (no audio, and Spotify's tempo is algorithmic, not ground truth). Examples: `maharshipandya/-spotify-tracks-dataset`, `enesayata/house-music-dj-library-key-bpm-and-chroma`.
- **Other osu! / rhythm-game sets.** HF `project-riz/osu-beatmaps` (299 GB webdataset, license "other") has audio plus beatmaps. Beatmap timing points are community-made, not research ground truth. I did not inspect it further.

### Inferences
- **For band-style pop/rock**, the best option today is **RWC-P** (100 studio J-pop/pop songs with beats and downbeats, official and open since 2026). After that comes **GTZAN** rock, pop, country, blues and disco (30 s clips, 100 per genre). Harmonix is the largest Western pop set, but only as vocoded audio.
- **Leakage matrix** (✔ = the model's training data includes this set, per the lists in the brief):

| Dataset | Beat This! | madmom | BeatNet | TempoCNN | librosa / Essentia (DSP) |
|---|---|---|---|---|---|
| GTZAN | – | – | – | – | clean |
| RWC-P | ✔ | ✔ (RWC Pop) | – | – | clean |
| GuitarSet | ✔ | – | – | – | clean |
| Ballroom | ✔ | ✔ | ✔ | – (Ext. Ballroom minus Ballroom) | clean |
| Harmonix | ✔ | – | – | – | clean |
| Candombe | ✔ | – | – | – | clean |
| BRID | – | – | – | – | clean |
| GiantSteps Tempo | – | – | – | MTG tempo is the same Beatport domain but different tracks | clean |

  - DeepRhythm's training data is unknown, so all of these are "unknown" for it.
- **GTZAN is the only quick set that is held out for every learned model.** Beat This! and BeatNet use it as a test set.
- **Suggested Kaggle plan:**
  1. `hf_hub_download` or `snapshot_download("m-a-p/GTZAN", repo_type="dataset", allow_patterns=["genres/*","GTZAN-Rhythm_v2_ismir2015_lbd/jams/*"])` (about 1.3 GB).
  2. Download Zenodo `RWC-P.zip` (4.07 GB) and git-clone rwc-annotations.
  3. Optionally `wget` Ballroom from MTG plus CPJKU annotations, as a leaky sanity check.

### Gaps
- **Kaggle coverage is partial.** The public search endpoint only matches titles. Without a token I could not run the CLI full-text search, so a Kaggle copy of Ballroom/SMC/Harmonix audio under an unrelated title could exist undetected.
- **GTZAN version mismatch.** I did not check whether `TempoBeatDownbeat/gtzan_tempo_beat` (mirdata) differs from the GTZAN-Rhythm v2 JAMS bundled in `m-a-p/GTZAN`; its README only says "Tempo and beat annotations for GTZAN Genre dataset".
- **`alonhaviv/guitarset` JAMS not opened.** Downloading a Kaggle file needs auth, so the beat_position and tempo namespaces are CLAIMED from the GuitarSet format.
- **Harmonix BigVGAN audio not measured.** I did not check audio quality, timing alignment or license for `m-a-p/harmonixset_bigvgan`. That it is resynthesized is an inference from the name and from Harmonix publishing only mel spectrograms.
- **No public audio found** for Hainsworth, HJDB, Simac, ACM Mirum, ISMIR04 songs, Rock Corpus, TapCorrect or JAAH. JAAH (Zenodo 1290737, 0.32 GB) looks like annotations only; I did not open it.
- **GiantSteps:** only one backup mp3 was tested, so I could not confirm all 664 files are present on the JKU backup.
