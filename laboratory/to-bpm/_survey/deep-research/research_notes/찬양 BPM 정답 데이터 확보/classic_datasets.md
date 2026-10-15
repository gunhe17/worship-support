# Classic public ground-truth datasets for tempo, beat and downbeat tracking (as of Oct 2026)

Scope: established datasets that could be added beyond GTZAN to evaluate 14 BPM/beat/downbeat methods on full-length worship/CCM songs (4–7 min, pop/rock band, often live, key-ups, occasional tempo changes). Leakage into training sets is noted only briefly here.

## Q1. Size, length and annotation type per dataset

### Takeaway
Most classic sets are short clips (20–40 s: Ballroom, SMC, ISMIR04, ACM Mirum, Extended Ballroom; ~2 min: GiantSteps). Only a few have **full-length songs with beats and downbeats**: Beatles (180), RWC Popular (100), Harmonix (912), Rock Corpus (200), Robbie Williams (65) and Hainsworth (222, mixed lengths). These are the closest proxies for 4–7 min band songs. GTZAN is itself 30 s clips.

### Cited Findings
**Sizes from Böck, Krebs & Widmer, ISMIR 2016 (Table 1, the madmom downbeat model paper)** — [ISMIR 2016 PDF](https://archives.ismir.net/ismir2016/paper/000186.pdf):
- Ballroom: 685 files, 5h57m. 13 duplicates (identified by Bob Sturm) were removed from the original 698.
- Beatles: 180 files, 8h09m (full songs).
- Hainsworth: 222 files, 3h19m.
- HJDB: 235 files, 3h19m.
- RWC Popular: 100 files, 6h47m (full songs).
- Robbie Williams: 65 files, 4h31m.
- Rock (de Clercq/Temperley): 200 files, 12h53m (full songs).
- Carnatic: 176 files, 16h38m. Cretan: 42 files, 2h20m. Turkish: 93 files, 1h33m.
- GTZAN: 999 files, 8h20m (test only). Klapuri: 320 files, 4h54m with downbeats; 474 files, 7h22m with beats only (test only, except 40 of the 320 tracks, which were used for training).
- SMC: 217 files, 2h25m, beats only.
- The Klapuri beat and downbeat annotations "were made independently, thus the positions do not necessarily match each other."

**Individual datasets**
- **Ballroom (ISMIR 2004 contest).** 698 instances of about 30 s each (~20,940 s total), labelled with 8 dance styles. A 697-excerpt count also appears in the literature — [MTG ISMIR04 contest](https://mtg.upf.edu/ismir2004/contest/tempoContest/node5.html), [ISMIR 2013 paper](https://archives.ismir.net/ismir2013/paper/000051.pdf). Beat and downbeat annotations were done manually by Krebs et al. (ISMIR 2013), "in cases of disagreement on the metrical level we relied on the existing tempo and meter annotations" — [ISMIR 2013](https://archives.ismir.net/ismir2013/paper/000051.pdf). mirdata lists 698 tracks with beats, tempo and genre, CC0 1.0 — [mirdata quick reference](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Extended Ballroom (Marchand & Peeters, IRCAM, 2016).** 4,180 tracks (about 6x the original), 30 s excerpts, with repetitions (duplicates) annotated semi-automatically and new rhythm classes — [Marchand extended PDF](https://bpb-us-e1.wpmucdn.com/wp.nyu.edu/dist/2/2294/files/2016/08/marchand-extended.pdf). It is primarily a tempo/rhythm-class set; I found no confirmation that it has beat or downbeat annotations.
- **ISMIR04 "songs" set.** 465 excerpts of about 20 s. A professional musician placed beat marks, and the ground-truth tempo is the median inter-beat interval — [MTG contest node6](https://mtg.upf.edu/ismir2004/contest/tempoContest/node6.html).
- **Hainsworth.** 222 tracks, beats and tempo. mirdata has no audio download (❌) and the license is CC0 1.0 — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html). Hung et al. note that Hainsworth "covers more diverse genres (e.g., classical, folk, and jazz)" — [arXiv 2205.14701](https://arxiv.org/pdf/2205.14701).
- **SMC_MIREX (Holzapfel, Davies, Zapata, Oliveira, Gouyon 2012).** 217 excerpts of 40 s, mono 44.1 kHz, ~2h25m, beats only (no downbeats). The excerpts were selected by query-by-committee, keeping those with the lowest agreement among beat trackers. Each excerpt comes with free-text difficulty tags (expressive timing, missing bass, ternary meter, etc.) — [SMC Blind Spot, arXiv 2605.12287](https://arxiv.org/pdf/2605.12287), [MIREX SMC results](https://nema.lis.illinois.edu/nema_out/mirex2012/results/abt/smc).
- **SMC finding from 2026.** madmom's DBN default minimum tempo of 55 BPM prevents the correct tempo from being inferred on 21% of SMC tracks — [arXiv 2605.12287](https://arxiv.org/pdf/2605.12287).
- **Beatles (Isophonics; beats/downbeats by M. Davies).** 180 tracks, with beats, chords, sections, key and vocal activity. Audio is not downloadable (❌) and mirdata lists no license (❌) — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **RWC Popular (AIST annotations).** 100 tracks, with beats, sections, vocal activity, chords and tempo. Audio is not downloadable and the license is custom (AIST) — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html). RWC Classical (61), Jazz (50) and Royalty-free sets also exist. Böck partially corrected the Pop annotations, and Foscarin made further corrections in v1.1 — [beat_this_annotations](https://github.com/CPJKU/beat_this_annotations).
- **Harmonix Set (Nieto et al., ISMIR 2019).** 912 Western pop tracks with beats, downbeats (beat position in bar, bar number) and functional segments; JAMS files are included. Audio is not distributed. Instead the set provides YouTube URLs, DTW alignment scores and mel spectrograms (Dropbox, ~1.2 GB, license agreement required). The repo is MIT-licensed — [harmonixset GitHub](https://github.com/urinieto/harmonixset).
- **Harmonix caveats.** Hung et al. describe it as "912 pop/rock songs with more than 56 hours". "The original audio files … are not available, but reference YouTube links are provided. Our investigation indicated there are many errors when aligning the annotations with the YouTube audio," so they manually adjusted the annotations — [arXiv 2205.14701](https://arxiv.org/pdf/2205.14701).
- **GiantSteps Tempo.** 664 Beatport EDM previews, mostly ~120 s (six are shorter). Audio is fetched with `audio_dl.sh` from `geo-samples.beatport.com/lofi/<id>.mp3` (~1 GB). There are two annotation versions: v1 (Knees et al. 2015, from user BPM corrections on forums) and v2 (Schreiber & Müller 2018). The repo states no license. In v2, three files have no tempo (0.0) — [giantsteps-tempo-dataset](https://github.com/GiantSteps/giantsteps-tempo-dataset). mirdata marks the audio as 📺 (fetched from a remote source) with CC BY-SA 4.0 — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Schreiber & Müller ISMIR 2018 (v2).** A crowdsourced experiment with 266 participants produced per-track tempo distributions, and the tempo ambiguities were attributed to annotator subjectivity and tempo instability. The raw beats and derived tempi are on Zenodo — [ISMIR 2018 paper](https://ismir2018.ismir.net/doc/pdfs/220_Paper.pdf), [Zenodo 3553625](https://zenodo.org/record/3553625).
- **ACM Mirum (Peeters & Flocon-Cholet 2012).** Reported as 1,410 30-second excerpts, pop/rock, tempo only. This comes from a single secondary table; I could not find a primary source — [AI and Tempo Estimation review, arXiv 2401.00209](https://arxiv.org/pdf/2401.00209). Böck's ISMIR2019 supplementary repo contains an `acm_mirum` folder — [superbock/ISMIR2019](https://github.com/superbock/ISMIR2019).
- **HJDB (Hockman, Davies, Fujinaga, ISMIR 2012).** Hardcore, jungle and drum & bass. The paper evaluated 206 pieces — [ISMIR 2012](https://archives.ismir.net/ismir2012/paper/000169.pdf). Böck 2016 uses 235 files — [ISMIR 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf).
- **Simac.** 595 tracks, beats and tempo, no audio (❌), CC0 1.0 — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html). Beat This treats it as beats only — [Beat This! paper HTML](https://arxiv.org/html/2407.21658).
- **Candombe.** 35 tracks with beats (and downbeats, used in Beat This), audio downloadable, CC BY-NC-SA 4.0 — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Rock Corpus (RS 200, de Clercq & Temperley).** 200 songs from Rolling Stone's "500 Greatest Songs", mostly rock. Timing data is "referenced to the original audio files", so the audio is not included — [rockcorpus.midside.com](https://rockcorpus.midside.com/), [Papers with Code](https://astro.paperswithcode.com/dataset/rock-corpus).
- **GTZAN-Rhythm (Marchand, Fresnel, Peeters, IRCAM 2015).** Manual beat, downbeat and swing (eighth-note) annotations for all 1,000 GTZAN 30 s excerpts — [HAL hal-01252607](https://hal.archives-ouvertes.fr/hal-01252607), [ISMIR 2015 LBD](https://www.ismir2015.uma.es/LBD/LBD20.pdf).
- **TempoBeatDownbeat/gtzan_tempo_beat.** A repo with `beats` and `tempo` folders. The README says only "Tempo and beat annotations for GTZAN Genre dataset" — [GitHub](https://github.com/TempoBeatDownbeat/gtzan_tempo_beat).
- **Carnatic (CompMusic).** 176 tracks with beats and meter; access needs a request (🔑); CC BY-NC-SA 4.0 — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **GuitarSet.** 360 tracks with beats, chords, key, tempo, notes and F0; audio downloadable; MIT — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Filosax.** 48 tracks (jazz sax with backing), access needs a request (🔑) — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html). Beat This used only the backing tracks — [Beat This! paper](https://arxiv.org/html/2407.21658).
- **Other beat sets in mirdata:**
  - BRID: 367, CC BY-NC-SA.
  - Groove MIDI: 1,150, CC BY-SA.
  - Jazz Trio Database: 1,294, MIT, 🔑.
  - Dagstuhl ChoirSet: 108.
  - Saraga Carnatic: 249. Saraga Hindustani: 108.
  - Hindustani Rhythm: 151.

  Source for all of the above — [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Other sets used by Beat This:** ASAP (piano; tracks with "rubato" beat annotations discarded), TapCorrect (Chordify) and JAAH (jazz; beats corrected and downbeats added) — [Beat This! paper](https://arxiv.org/html/2407.21658), [beat_this_annotations](https://github.com/CPJKU/beat_this_annotations).
- **tempo_eval corpora (Schreiber).** The report lists 22 corpora: acm_mirum, ballroom, beatles, fma_medium, fma_small, giantsteps_mtg_key, giantsteps_tempo, gtzan, hainsworth, hjdb, ismir2004songs, klapuri, lmd_tempo, queen, rwc_mdb_c/g/j/p/r, simac, smc_mirex and wjd. Each has multiple annotation versions in JAMS — [tempo_eval report](https://tempoeval.github.io/tempo_eval_report/index.html), [tempo_eval GitHub](https://github.com/tempoeval/tempo_eval).

### Inferences
- **Closest to the worship/CCM target** (full-length, pop/rock band, beats and downbeats): Harmonix (912 tracks, ~56 h), RWC Popular (100), Beatles (180), Rock Corpus (200) and Robbie Williams (65).
  - Most clip sets do not exercise the issues specific to 4–7 min live songs: tempo drift, key-up modulations, and intros/outros with no drums.
  - None of these sets is gospel/CCM-specific, and I found no classic dataset centred on live worship band recordings.
- **Single global tempo:** Ballroom, ISMIR04, ACM Mirum, Extended Ballroom and GiantSteps are tempo-centric with a single global tempo per track.
  - ISMIR04 tempo is defined as the median IBI.
  - Schreiber's v2 GiantSteps gives a tempo distribution, which helps when tempo is ambiguous at the octave level.
- **Time-varying tempo:** this can be derived from beat annotations (Beatles, RWC, Harmonix, Hainsworth, SMC).
- **Expressive timing:** SMC is the main stress test for this.

### Gaps
- I did not verify per-dataset total hours for Harmonix (only ">56 h"), Simac, Candombe, ACM Mirum, Extended Ballroom or Rock Corpus beyond Böck's 12h53m.
- ACM Mirum details rest on one secondary source.
- The HJDB count differs between sources (206 vs 235).
- I found no reliable source on the number of tracks with tempo changes per dataset. I also found nothing on how many tracks are live recordings: Beatles and RWC are studio recordings, and Harmonix YouTube versions may include live or alternate versions.

## Q2. Audio availability, license and download (2025–2026)

### Takeaway
Freely downloadable audio plus annotations: Ballroom, GTZAN, GuitarSet, Candombe, Groove MIDI, BRID, Saraga, and GiantSteps (Beatport preview URLs).
- **No audio distributed:** Beatles (buy the CDs), RWC (purchase from AIST), Hainsworth, Simac, SMC (on request / circulates privately), Rock Corpus (own the recordings), Harmonix (YouTube only, with alignment problems).
- **Beat This workaround:** precomputed spectrograms for all 16 of its datasets are on Zenodo, which gets around the audio problem for model training but not for running third-party methods on audio.

### Cited Findings
- **mirdata "Downloadable" column:**
  - ✅ Ballroom, BRID, Candombe, Dagstuhl, Groove MIDI, GTZAN, GuitarSet, Saraga.
  - 🔑 (request required) Carnatic/Hindustani Rhythm, Filosax, Jazz Trio DB.
  - 📺 (remote/YouTube) GiantSteps Tempo.
  - ❌ Beatles, Cuidado, Hainsworth, RWC (classical/jazz/popular), SIMAC.

  Licenses: Ballroom, Hainsworth and SIMAC annotations are CC0; RWC is custom; Beatles is unlisted — [mirdata quick reference](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html).
- **Beat This annotations.** All of them are in [CPJKU/beat_this_annotations](https://github.com/CPJKU/beat_this_annotations): v1.0 matches the paper and v1.1 has corrections. The repo is MIT, with no per-dataset licenses stated.
  - Ballroom, Beatles, GTZAN, Hainsworth, HJDB, Simac and SMC annotations come from superbock/ISMIR2019.
  - Spectrograms are on [Zenodo 13922116](https://zenodo.org/records/13922116), one zip per dataset.
  - Recreating them requires the original audio. "Some of the training files are fully copyrighted or under limited Creative Commons licenses" — [beat_this README](https://github.com/CPJKU/beat_this).
- **superbock/ISMIR2019.** Annotation folders for acm_mirum, ballroom, beatles, giantsteps, gtzan, hainsworth, hjdb, simac and smc. No license file is shown — [GitHub](https://github.com/superbock/ISMIR2019).
- **Harmonix.** YouTube URLs only, plus mel spectrograms gated by a license — [harmonixset](https://github.com/urinieto/harmonixset). "Original audio files … are not available" — [Hung et al. 2022](https://arxiv.org/pdf/2205.14701).
- **GiantSteps.** Audio from Beatport preview URLs via a script; the repo does not say whether any links are broken — [GitHub](https://github.com/GiantSteps/giantsteps-tempo-dataset).

### Inferences
- **Harmonix YouTube availability:** some fraction of the videos has probably disappeared by 2026, since YouTube-ID datasets typically decay. This is unverified.
- **Beatport preview URLs** may also break; I did not check them live.
- **Practical approach for worship evaluation:** run all 14 methods only on sets where you hold the audio. GTZAN, Ballroom, GuitarSet and Candombe are free. Beatles and RWC need purchase. Harmonix needs YouTube retrieval plus re-alignment; Hung et al. warn of many misalignments.

### Gaps
- I did not live-check the 2026 status of the Harmonix YouTube links, the Beatport preview links or the Hainsworth/SMC distribution.
- Licenses for the SMC, HJDB and Rock Corpus annotations were not found.

## Q3. Known annotation errors and corrected versions

### Takeaway
Corrected versions exist for several sets:
- **GTZAN:** GTZAN-Rhythm and later corrections; Beat This notes quality issues.
- **Ballroom:** remove the 13 duplicates.
- **GiantSteps Tempo:** Schreiber's v2.
- **RWC Pop:** Böck and Foscarin fixes.
- **Harmonix:** Hung et al. re-alignment and Foscarin v1.1.
- **JAAH and Filosax:** Foscarin/Vogl corrections.

Use the CPJKU beat_this_annotations v1.1 as the most up-to-date consolidated source.

### Cited Findings
- **Ballroom:** 13 duplicates (identified by Bob Sturm) removed, leaving 685 — [Böck 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf).
- **GiantSteps:** v2 tempo from crowdsourcing (Schreiber & Müller 2018); v1 came from user BPM corrections — [GitHub](https://github.com/GiantSteps/giantsteps-tempo-dataset), [ISMIR 2018](https://ismir2018.ismir.net/doc/pdfs/220_Paper.pdf).
- **beat_this_annotations corrections** — [GitHub](https://github.com/CPJKU/beat_this_annotations):
  - Harmonix was "reproduced and partially corrected" per arXiv:2205.14701, and v1.1 fixes a negative onset.
  - RWC Pop annotations were partially corrected by Böck, with further v1.1 corrections by Foscarin.
  - JAAH beats were corrected and downbeats added.
  - Filosax was partially corrected.
- **Beat This paper:**
  - GTZAN: 1 unannotated track and 6 tracks without downbeats discarded, leaving 993. The paper discusses GTZAN annotation quality issues.
  - Beatles: one piece without downbeats and one with empty beats were discarded.
  - ASAP: "rubato" tracks dropped.

  Source — [arXiv 2407.21658](https://arxiv.org/html/2407.21658).
- **Klapuri:** the beat and downbeat annotations were made independently and do not necessarily align — [Böck 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf).

### Inferences
- When reporting accuracy on Ballroom, GTZAN or RWC Pop, state the annotation version. Results shift by a few F1 points between versions.

### Gaps
- I did not retrieve the specific GTZAN annotation error list from the Beat This paper (Sec. 4.5) or the tempo_eval per-version deltas.

## Q4. Overlap with Beat This! and madmom training sets (brief)

### Takeaway
Beat This trains on everything except GTZAN (4,556 tracks), so its GTZAN scores are clean. Harmonix, RWC Pop, Beatles, Ballroom, Hainsworth, SMC and the others are in-domain for Beat This.
- **madmom downbeat RNN:** trained on Ballroom, Beatles, Hainsworth, HJDB, RWC Pop, Robbie Williams, Rock, Carnatic, Cretan, Turkish and 40 Klapuri tracks.
- **madmom beat model:** used SMC in training.
- **Harmonix** was not in madmom's training data.
- **GiantSteps and ACM Mirum** are tempo-only and were used in Böck's tempo work (ISMIR2019 repo); they are not in the beat training lists cited here.

### Cited Findings
- **Beat This training/validation (8-fold):** Simac, SMC, Hainsworth, Ballroom, HJDB, Beatles, Harmonix, RWC Classical/Pop/Royalty-free/Jazz, TapCorrect, JAAH, Filosax, ASAP, Groove MIDI, GuitarSet, Candombe. GTZAN (993) is test only. Total train/val: 4,556 tracks — [arXiv 2407.21658](https://arxiv.org/html/2407.21658), [beat_this README](https://github.com/CPJKU/beat_this).
- **madmom 2016 downbeat model:**
  - Trained on: Ballroom, Beatles, Hainsworth, HJDB, RWC Popular, Robbie Williams, Rock, Carnatic, Cretan, Turkish, and 40 of the 320 Klapuri tracks.
  - Held out: GTZAN, SMC, Klapuri.
  - Böck et al. 2014 (the beat tracker) used the complete SMC set for training.

  Source — [ISMIR 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf).
- **Harmonix and madmom:** "Harmonix Set was not included in the training set of madmom" — [Hung et al. 2022](https://arxiv.org/pdf/2205.14701).

### Inferences
- **Fair comparison:** the cleanest cross-method sets for comparing Beat This and madmom are GTZAN plus any new worship data you create yourself. Harmonix favours Beat This over madmom (it is in Beat This training but not madmom's). Ballroom, Beatles and RWC Pop are in both.
- **Who else is affected:** TempoCNN, DeepRhythm and BeatNet also have their own training sets (not covered here; see the leakage notes).

### Gaps
- Exact training sets for madmom's tempo model, BeatNet, TempoCNN and DeepRhythm are not covered here; another researcher handles leakage.

---

## Comparison table

Abbreviations: B = beats, DB = downbeats, T = tempo. BT = Beat This! training. mm = madmom RNN training.

| Dataset | Tracks | Length (each / total) | Annot. | Genre | Audio (2026) | Annot. license / source | In BT train | In mm train |
|---|---|---|---|---|---|---|---|---|
| GTZAN (+GTZAN-Rhythm) | 1000 (993 used) | 30 s / 8h20m | B, DB, T, swing | 10 genres incl. pop, rock | ✅ free (GTZAN) | Marchand/IRCAM; ISMIR2019 repo | No (test) | No (test) |
| Ballroom | 698 (685 dedup) | 30 s / 5h57m | B, DB, T | Ballroom dance | ✅ mirdata | CC0 (mirdata) | Yes | Yes |
| Extended Ballroom | 4180 | 30 s | T, class | Ballroom dance | download script (status unverified) | IRCAM | No | No |
| ISMIR04 songs | 465 | ~20 s | B → T | Mixed | Limited / old | MTG contest | No | No |
| Hainsworth | 222 | mixed / 3h19m | B, DB, T | Diverse (classical, folk, jazz, pop) | ❌ | CC0 (mirdata) | Yes | Yes |
| SMC_MIREX | 217 | 40 s / 2h25m | B only | Hard / expressive | ❌ (on request) | ISMIR2019 repo | Yes | Yes (beat model) |
| Simac | 595 | clips | B, T | Mixed | ❌ | CC0 (mirdata) | Yes (B) | — |
| HJDB | 235 | / 3h19m | B, DB | Jungle / DnB | ❌ | ISMIR2019 repo | Yes | Yes |
| Beatles (Isophonics/Davies) | 180 | full / 8h09m | B, DB | Pop/rock (studio) | ❌ buy CDs | not stated | Yes | Yes |
| RWC Popular | 100 | full / 6h47m | B, DB, T | J-pop / pop (studio) | ❌ purchase AIST | Custom (AIST) | Yes | Yes |
| RWC Classical / Jazz / Royalty-free | 61 / 50 / — | full | B, DB | Classical / jazz | ❌ purchase | Custom | Yes | No |
| Harmonix Set | 912 | full / >56 h | B, DB, segments | Western pop/rock | YouTube IDs + mel specs; misalignments | MIT repo | Yes | No |
| Rock Corpus (RS200) | 200 | full / 12h53m | B, DB (timing) | Rock | ❌ own recordings | rockcorpus.midside.com | No | Yes |
| Robbie Williams | 65 | full / 4h31m | B, DB | Pop | ❌ | — | No | Yes |
| GiantSteps Tempo (v1/v2) | 664 | ~2 min | T (v2 distribution) | EDM | 📺 Beatport preview script | CC BY-SA (mirdata) | No | No (beat) |
| ACM Mirum | 1410 (secondary source) | 30 s | T | Pop/rock | unclear | ISMIR2019 repo | No | No |
| Klapuri | 474 / 320 | / 7h22m | B, DB (independent) | Mixed | ❌ | — | No | 40 tracks |
| Candombe | 35 | full | B, DB | Uruguayan candombe | ✅ | CC BY-NC-SA | Yes | No |
| Carnatic | 176 | full / 16h38m | B, meter | Indian art music | 🔑 | CC BY-NC-SA | No | Yes |
| GuitarSet | 360 | short | B, T | Solo guitar | ✅ | MIT | Yes (comping) | No |
| Filosax | 48 | full | B, T | Jazz sax + backing | 🔑 | — | Yes (backing) | No |
| JAAH / Jazz Trio DB | — / 1294 | full | B (+DB in BT) | Jazz | YouTube / 🔑 | MIT (JTD) | JAAH yes | No |
| Groove MIDI | 1150 | short | B, T | Drums (MIDI renders) | ✅ | CC BY-SA | Yes | No |
| LMD tempo (tempo_eval) | ? | ? | T | Pop (MIDI-derived) | — | tempo_eval | No | No |

**Recommendation for the worship benchmark (inference):** add Harmonix (full-length pop/rock; requires YouTube retrieval and re-alignment), RWC Popular and Beatles (full-length; require purchase), plus Ballroom and SMC as cheap stress and tempo sanity checks. Note that every one of these is in Beat This training.
