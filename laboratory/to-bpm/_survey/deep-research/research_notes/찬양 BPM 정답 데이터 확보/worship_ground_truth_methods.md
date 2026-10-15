# 찬양(CCM) BPM/비트/다운비트 정답 데이터 확보 방법 (as of 2026-10)

Scope: 마커스워십, 어노인팅, 제이어스(J-US), 위러브(WELOVE), 예수전도단 + 해외 워십곡. Personal non-commercial research; audio not redistributed.

## 1. Metadata sources with BPM / time signature

### Takeaway
MultiTracks.com is the strongest metadata source: each song page lists one BPM + time signature taken from the release session, and flags songs with tempo variations (but does not publish the tempo map itself). Planning Center stores BPM/meter per arrangement (often imported from SongSelect/PraiseCharts/WorshipTogether). Spotify audio-features is closed to new apps since 2024-11-27. Korean coverage exists via MultiTracks.co.kr (WELOVE, J-US, Levites, Team Luke, Whole Life Worship) but Markers/Anointing/YWAM coverage was not confirmed.

### Cited Findings
- MultiTracks song page example (Elevation Worship "Graves Into Gardens"): Key B, **BPM 70, Time Sig 6/8**, length 7:31, and the note "This song includes tempo variations so we recommend you use the included click." Click & Guide are downloadable stems; no per-section tempo values shown. — [MultiTracks song page](https://www.multitracks.com/songs/Elevation-Worship/Graves-Into-Gardens/Graves-Into-Gardens/)
  - Note the octave convention: a 6/8 song listed at 70 BPM means the BPM refers to the dotted-quarter (or the click's pulse), not eighth notes. Convention must be checked per song before comparing to tracker output.
- MultiTracks.co.kr (Korean sister site) launched Aug 2024; artists listed: WELOVE, J-US, Levites, Team Luke Worship, Whole Life Worship, "with more artists to come"; same account as MultiTracks.com. Catalog size not stated. — [GospelMusic.org](https://gospelmusic.org/news/multitracks.com-launches-in-south-korea)
- PraiseCharts song pages list Meter (e.g., 4/4) and a word-label tempo ("Med Fast", "Slow") rather than exact BPM on some pages; sells click tracks and multitracks ("guide, click track"); has a "popular worship songs in South Korea" list with Korean/English sheets. — [PraiseCharts Psalm 23 click](https://praisecharts.com/songs/details/81927/psalm-23-sheet-music/click-track); [PraiseCharts Still](https://praisecharts.com/songs/details/1822/still-sheet-music/lead-sheet-sat); [PraiseCharts Korea list](https://praisecharts.com/song-lists/popular-worship-songs-in-south-korea)
- Musicnotes worship arrangements include a metronome marking (e.g., ♩=72 "worshipfully"). — [Musicnotes example](https://www.musicnotes.com/sheetmusic/passion/sometimes/MN0091534_D4)
- Planning Center Services: each song **arrangement** has BPM and Meter fields; editable via Music Stand metronome ("Save" new tempo to arrangement); BPM/meter can be shown in order of service; song data can be imported from SongSelect, PraiseCharts, RehearsalMix; WorshipTogether integration "chord pros include song themes and BPMs". — [PCO add/edit arrangement](https://help.planningcenter.com/en/add-or-edit-an-arrangement.html); [PCO metronome](https://help.planningcenter.com/en/use-the-metronome.html); [PCO changelog](https://www.planningcenter.com/changelog/services/new-view-the-song-bpm-meter-and-sequence-in-the-music-stand-order-of-service); [PCO songs page](https://help.planningcenter.com/en/songs-page.html); [PCO WorshipTogether](https://www.planningcenter.com/integrations/worshiptogether)
- Spotify Web API (official, 2024-11-27): Audio Features and Audio Analysis (plus Recommendations, Related Artists, preview URLs, etc.) restricted for apps registered on/after that date and dev-mode apps without pending extension; existing extended-mode apps unaffected. — [Spotify developer blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
  - Community reports through 2025 of 403 on /v1/audio-features for new apps. — [Spotify community](https://community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-v1-audio-features-using-both-user-and-client/m-p/7200198)
- GetSongBPM: "mainly uses its own audio recognition scripts (tempo, key…)" plus user reports, third-party APIs, datasets, manual checks — i.e., mostly algorithmic estimates. — [GetSongBPM About](https://getsongbpm.com/about)
- Tunebat states it is powered by tech from UPF Music Technology Group (i.e., Essentia-type algorithmic analysis). — [mp3tag community copy of Tunebat page](https://community.mp3tag.de/t/ws-tunebat-songkeybpm/49503) (secondary)

### Inferences
- Reliability ranking for BPM *value*: MultiTracks (from the actual click used in the master session) > PCO/WorshipTogether/PraiseCharts (publisher/arranger-entered, sometimes word labels) > sheet ♩= markings (arranger's choice) > Tunebat/GetSongBPM/Spotify (algorithmic; same octave errors you are trying to evaluate — circular as ground truth).
- A single BPM does not capture tempo changes; MultiTracks' "tempo variations" flag is itself useful as a label for "has tempo change" subset.
- Practical Korean path: MultiTracks.co.kr for WELOVE/J-US; for Markers/Anointing/YWAM, fall back to sheet ♩= or manual annotation.

### Gaps
- Could not confirm whether CCLI SongSelect publishes a numeric BPM on lead sheets / in metadata (no SongSelect doc found). PCO import from SongSelect suggests some tempo/meter metadata may come along, unverified.
- No confirmation that 마커스워십, 어노인팅, 예수전도단 are on MultiTracks.co.kr; catalog not crawled. Melon/Bugs: no evidence they expose BPM metadata publicly.
- Loop Community BPM fields not checked.
- No public API for MultiTracks metadata; scraping is prohibited by ToS (see §2).
- Korean 악보 사이트 (e.g., 찬양악보 커뮤니티) ♩= coverage not researched; Korean search returned nothing relevant.

## 2. Multitrack / click-track derived ground truth

### Takeaway
Purchasing a MultiTracks download gives a Click stem time-aligned to the master — onset-detecting the click yields near-exact beat times, and accent clicks (if present) yield downbeats, including tempo changes. Legally, personal non-commercial use of a purchased download is allowed; the ToS bans sharing, derivative recordings, and scraping, and does not mention ML/analysis explicitly.

### Cited Findings
- MultiTracks downloads include Click and Guide stems; preview "Click & Guide left, tracks right". — [MultiTracks song page](https://www.multitracks.com/songs/Elevation-Worship/Graves-Into-Gardens/Graves-Into-Gardens/)
- Worship-leader guidance: use click on every song; band and MultiTracks only stay in sync via the click — i.e., worship recordings in this ecosystem are commonly click-locked. — [MultiTracks blog interview](https://multitracks.com/blog/all-about-worship-interview-with-multitracks-com)
- MultiTracks ToS: downloads "solely for personal and non-commercial use"; no sharing; individual purchase for that individual only; cloud upload only for archival; derivative recordings require separate license; anti-scraping clause ("collect, copy, mine… scraping"); $1,000 liquidated damages per download per misuse instance. No explicit ML/AI clause. — [MultiTracks Terms](https://www.multitracks.com/terms/)

### Inferences
- Pipeline: click stem → simple onset detection (librosa onset / peak picking; clicks are clean impulses) → beat times; louder/higher-pitched accent click → downbeats; inter-click intervals → tempo curve incl. ramps/changes. Accuracy limited only by the click stem alignment (should be sample-locked to stems).
- Caveat: the MultiTracks stems are the *studio/live master*; the commercial streaming release may be a different edit/master (fades, cuts, radio edit). Need to align click stem to the target recording (cross-correlate the mixed stems vs. release audio) or simply evaluate on the summed stems.
- Caveat: click may continue through free-time intros/ad-lib sections where the band is not strictly in time; or be absent in rubato parts.
- Cost: MultiTracks downloads are paid per song (price not verified here); a 30–50 song eval set is a tens-to-hundreds-USD-scale budget (unverified).
- Legal reading: analysing a purchased copy privately for research and storing only derived timestamps (not audio) is the lowest-risk use; publishing the derived annotations is likely fine (facts/timestamps) but not legal advice. Don't bulk-scrape song pages for BPM.

### Gaps
- Price per download and whether click stems include accent on beat 1 for all songs not verified.
- Whether PraiseCharts click tracks are tempo-mapped to the original recording (vs. generic metronome) not verified.

## 3. Sheet music / MIDI alignment

### Takeaway
Sheet ♩= and time signature give a nominal tempo and the meter (resolving octave by the notated beat); for beat times, score/MIDI-to-audio alignment with Sync Toolbox (DTW) is feasible but requires a symbolic score (MIDI/MusicXML), which Korean lead sheets (PDF/images) rarely provide.

### Cited Findings
- Sync Toolbox (Müller, Özer, Krause, Prätzlich, Driedger, JOSS 2021): Python, multiscale DTW, memory-restricted MsDTW, high-resolution chroma-onset (DLNCO) alignment for audio/MIDI/sheet music; pip `synctoolbox`. — [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.03434.pdf); [PyPI](https://pypi.org/project/synctoolbox)
- Adding spectral-flux onset features to chroma improves alignment accuracy. — [Özer, Krause, Müller ISMIR 2021 LBD](https://archives.ismir.net/ismir2021/latebreaking/000025.pdf)

### Inferences
- Workflow: lead sheet → (OMR or manual entry) MIDI with correct form/repeats matching the recording → synthesize/chroma → DTW to audio → warp MIDI beat/bar grid to audio = beats+downbeats.
- Hard parts for worship: recordings repeat chorus/bridge an unpredictable number of times, add key changes, long intros/ad-libs — the score's form must be edited to match each recording (or use partial/subsequence DTW). Key changes break chroma alignment unless the MIDI includes them.
- DTW precision is typically tens of ms — fine for tempo/downbeat labels, borderline for ±70 ms beat F-measure; refine by snapping to onsets (same idea as §4).
- For Korean songs, cost of OMR/hand-entry likely exceeds cost of tap-and-correct; use sheet mainly for meter + nominal ♩= (octave decision).

### Gaps
- No Korean-specific OMR/MIDI source for worship lead sheets found.

## 4. Manual / semi-automatic annotation tools and workflows

### Takeaway
Best cost/accuracy: run a strong tracker (Beat This!/madmom DBN) → load in Sonic Visualiser → listen with click sonification, fix errors; or tap along and auto-snap taps to audio cues (Driedger et al. 2019). Raw taps lag/lead audio by ~tens of ms and must be corrected.

### Cited Findings
- Driedger, Schreiber, de Haas, Müller, "Towards Automatically Correcting Tapped Beat Annotations for Music Recordings", ISMIR 2019: taps recorded in Sonic Visualiser; raw taps "precede [audio cues] by about 80 milliseconds most of the time" in their example; manual tap correction is "cumbersome"; they snap taps to nearby activation peaks while preserving inter-tap intervals; release beat annotations for 101 YouTube recordings; listening test showed corrected taps perceived as more accurate. — [Paper PDF](https://www.audiolabs-erlangen.com/content/05_fau/professor/00_mueller/03_publications/2019_DriedgerSHM_BeatAnn_ISMIR_PrintedVersion.pdf); [ISMIR anthology](https://ir.webis.de/anthology/2019.ismir_conference-2019.22)
- Correcting beat-tracker output can be "just as cumbersome as manually correcting the taps" (same paper). — [Paper PDF](https://www.audiolabs-erlangen.com/content/05_fau/professor/00_mueller/03_publications/2019_DriedgerSHM_BeatAnn_ISMIR_PrintedVersion.pdf)
- Pinto, Domingues, Davies (ISMIR 2020 LBD) "Shift If You Can": counts shift/insert/delete operations needed to correct beat detections as an annotation-efficiency measure. — [ISMIR 2020 LBD 421](https://program.ismir2020.net/lbd_421.html)
- Beat This! annotations repo (CPJKU): annotations for the ISMIR 2024 paper; v1.1 has corrected annotations for several datasets — shows even published GT needs revisions. — [GitHub beat_this_annotations](https://github.com/CPJKU/beat_this_annotations)
- Holzapfel, Davies, Zapata, Oliveira, Gouyon, "Selective Sampling for Beat Tracking Evaluation" (IEEE TASLP 2012): mutual agreement among multiple beat trackers predicts difficulty without ground truth; used to build a dataset of hard excerpts. — [UPF repository](https://repositori.upf.edu/handle/10230/42182)

### Inferences
- Use selective sampling to prioritise: run 3–5 trackers (Beat This!, madmom, librosa, essentia, BeatNet); songs where they agree (high mutual agreement) → spot-check only; disagreement → full manual correction. Cuts annotation effort.
- Tools: Sonic Visualiser (tap with `;` key into time instants layer, sonify, export CSV), Audacity label track (export labels), DAW tempo maps (Logic Smart Tempo, Ableton warp markers → export MIDI tempo map). Downbeats: mark bar position "1" (Sonic Visualiser supports beat-number labels).
- Evaluate with mir_eval.beat (F-measure ±70 ms, CMLt/AMLt which accept double/half/off-beat) and mir_eval.tempo; report both strict and AML to separate octave errors.

### Gaps
- No quantitative per-song annotation time or inter-annotator agreement figures found in sources fetched (commonly-cited rule of thumb "several × song length" is unverified).
- Logic Smart Tempo / Ableton warp accuracy for this purpose: no sources checked.

## 5. Tapping / octave ambiguity — deciding the "correct" BPM

### Takeaway
Perceived tempo is inherently ambiguous across metrical levels (McKinney & Moelants 2006); for worship songs the pragmatic rule is to define GT by the notated meter / click pulse (the convention MultiTracks/PCO use, e.g. 6/8 at dotted-quarter 70), and evaluate with octave-tolerant metrics alongside strict ones.

### Cited Findings
- McKinney & Moelants, "Ambiguity in Tempo Perception: What Draws Listeners to Different Metrical Levels?" Music Perception 2006: listeners tapped the most salient pulse; for some excerpts taps cluster near ~120 BPM resonance, others well above/below; deviations tied to rhythmic accents. — [Abstract](https://cspeech.ucd.ie/rppw/rppw10/mckinney/abstract.html); [summary](https://sonicfield.org/library/ambiguity-in-tempo-perception-what-draws-listeners-to-different-metrical-levels)
- Related: McKinney & Moelants ISMIR 2004 "Extracting the perceptual tempo from music". — [ISMIR anthology](https://ir.webis.de/anthology/2004.ismir_conference-2004.42)
- MultiTracks lists a 6/8 ballad as 70 BPM (dotted-quarter pulse) — an industry convention that differs from an eighth-note reading (210). — [MultiTracks song page](https://www.multitracks.com/songs/Elevation-Worship/Graves-Into-Gardens/Graves-Into-Gardens/)

### Inferences
- Rule set proposal: (1) GT tempo = click/notated beat unit (quarter in 4/4, dotted quarter in 6/8/12/8); (2) store also the "felt" alternative (×2 or ×0.5) when worship-team practice differs (e.g., slow 4/4 ballads at 68 often felt in 8th at 136); (3) evaluate Acc1 (strict, ±4%) and Acc2 (octave-tolerant) via mir_eval.
- Worship-specific octave traps: 6/8 vs 3/4 vs 12/8; slow ballads with 16th-note hi-hats (trackers double); half-time bridges / "double-time" final choruses (genuine meter-level change, not a tempo change — label separately).
- Crowd tapping (e.g., 3–5 church musicians tapping each song) gives a distribution; majority level = perceptual GT, useful to report alongside notated GT.

### Gaps
- No public tapping dataset found from McKinney & Moelants; no worship-specific perceptual-tempo study found.

## 6. Synthetic data (MIDI render / stem mixing)

### Takeaway
Synthetic renders give exact beat/downbeat/tempo-change GT for free and are good for unit-testing edge cases (ramps, key-up, meter switches), but do not reflect real worship mixes (pads, ambient intros, reverb, live drift); use as a sanity suite, not the main benchmark.

### Cited Findings
- Sync Toolbox includes sonification utilities (useful for audible checks of grids). — [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.03434.pdf)

### Inferences
- Cheap options: pretty_midi/mido to write tempo-mapped MIDI → FluidSynth + GM soundfont render; or DawDreamer for VST rendering; or time-stretch real multitrack stems with a known click to new tempo maps (rubberband) — stems from purchased multitracks keep realism while GT stays exact (personal use only).
- Pros: exact GT, controllable difficulty, unlimited. Cons: domain gap, GM drums are too clean, no realistic rubato/ad-lib, risk of overfitting conclusions.

### Gaps
- No sources fetched on FluidSynth/DawDreamer evaluation pitfalls; domain-gap magnitude for beat tracking not quantified here.

## Recommended low-cost plan (synthesis)
1. 30–50 songs: buy MultiTracks(.co.kr) downloads for WELOVE/J-US + international songs → click-stem → exact beats/downbeats/tempo maps.
2. Markers/Anointing/YWAM: Beat This! + selective-sampling disagreement → Sonic Visualiser correction (or tap + Driedger-style snap); meter/♩= from sheet.
3. Octave policy = notated beat unit; report strict + octave-tolerant metrics.
4. Small synthetic suite for tempo-change / key-up edge cases.
5. Store only timestamps + song IDs; never redistribute audio; no scraping of vendor sites.
