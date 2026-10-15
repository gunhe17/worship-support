# Commercial / closed-source tempo & beat-grid tools usable in batch (alternatives to Logic Pro Smart Tempo)

Scope note: about 17 search/fetch calls. Many vendor manual pages (rekordbox, Studio One, Melodyne, Cyanite, AudD, Tunebat, VirtualDJ, djay) were not reached directly. Anything not backed by a URL is in Gaps.

## Q1. Which tools give per-song BPM AND beat positions in bulk, and how? (DJ software)

### Takeaway
DJ library apps are the most practical "commercial batch" route. You bulk-analyze in the GUI (one manual step), then parse the collection or tag data with open-source parsers. rekordbox is the strongest option: it has a documented XML schema with TEMPO change points, per-beat ANLZ PQTZ grids readable by pyrekordbox, and a "Dynamic" analysis mode for variable tempo. Traktor and Serato also store grids, but the formats are reverse-engineered or poorly documented.

### Cited Findings
**rekordbox (AlphaTheta/Pioneer)**
- pyrekordbox parses rekordbox ANLZ analysis files (`ANLZ0000.DAT/.EXT/.2EX`). The beat grid is tag `PQTZ` (`get_tag("PQTZ")` / `"beat_grid"`) and holds the precise time of each beat. — [pyrekordbox ANLZ tutorial](https://pyrekordbox.readthedocs.io/en/stable/tutorial/anlz.html)
- rekordbox XML export: each track's beat grid is a list of `TEMPO` elements with attributes `Inizio` (start position, s), `Bpm`, `Metro` (meter), and `Battito` (beat number in bar). Multiple TEMPO entries are tempo change points. — [pyrekordbox XML format](https://pyrekordbox.readthedocs.io/en/stable/formats/xml.html); [pyrekordbox rbxml API](https://pyrekordbox.readthedocs.io/en/stable/generated/pyrekordbox.rbxml.html)
- The XML includes beat grids and BPM change points only if the "BPM change points" option is enabled under Preferences > Advanced. The export path is File > Export Collection in xml format. — [Mixed In Key: export cue points to rekordbox](https://mixedinkey.com/workflows/export-cue-points-to-rekordbox/); [rekordcloud wiki](https://rekord.cloud/wiki/library-import)
- rekordbox master.db is SQLCipher-encrypted. The `rbox` library (and pyrekordbox) can read it, and `rbox` also exposes `get_beat_grid()` with beat number, tempo, and time. — [rbox on PyPI](https://pypi.org/project/rbox/)
- rekordbox has a "Dynamic" analysis mode for tracks with variable BPM, plus a manual Grid Edit mode. — [pointblank × rekordbox DJ programmes](https://rekordbox.com/en/connect/pointblank/dj-programmes/)
- Community wiki report: a third-party script adds beat markers every four beats on tracks analysed in rekordbox dynamic mode (used for conversion to Traktor), which implies dynamic grids are stored as many change points. — [dj-kb: Traktor Elastic Beatgrids](https://dj-kb.readthedocs.io/traktor_elastic_beatgrids/)
- A newer rekordbox "high precision analysis" option is mentioned by users. Details are unverified. — [Engine DJ community thread](https://community.enginedj.com/t/the-beatgrids-are-mostly-out-of-whack/63193)
- Caveat: some MP3s decode with a ~26 ms leading offset in some software, which shifts grids when moving XML between apps. — [Engine DJ community: beatgrid import incorrect](https://community.enginedj.com/t/beatgrid-import-incorrect-for-traktor-or-rekordbox/42780)

**Serato DJ**
- Serato writes its beat grid into an ID3 GEOB frame named "Serato BeatGrid" (alongside "Serato Markers2" and "Serato Overview"). The format is undocumented and was reverse-engineered by Jan Holthuis. — [Reversing Serato's GEOB tags](https://homepages.rub.de/jan.holthuis/reversing-seratos-geob-tags.html)
- `serato-tools` (Python, v4.0.1, 2026-02-27) reads and writes Serato track metadata including beatgrids. — [piwheels: serato-tools](https://www.piwheels.org/project/serato-tools/)
- `triseratops` (Rust) parses Serato metadata but needs a separate ID3 reader. — [triseratops crate](https://rust-digger.code-maven.com/crates/triseratops)
- Now Playing's Serato integration decodes the beatgrid GEOB, including mid-track tempo changes. — [Now Playing: Serato integration](https://help.nowplayingapp.com/reference/integrations/serato/)

**Traktor (Native Instruments)**
- Traktor's Analyze function detects the beatgrid automatically. — [NI support](https://support.native-instruments.com/hc/articles/210311665)
- Grids are stored in `collection.nml`, and possibly also in file tags. User reports conflict on the exact storage. — [DJTT forum: what saves where](https://forum.djtechtools.com/t/traktor-what-saves-where-questions/23522); [NI community](https://community.native-instruments.com/discussion/comment/171838)
- Traktor's grid model is essentially one tempo per track. "Elastic beatgrids" for variable tempo are discussed as a workaround or conversion topic. — [dj-kb: Traktor Elastic Beatgrids](https://dj-kb.readthedocs.io/traktor_elastic_beatgrids/)

**Engine DJ (Denon/inMusic)**
- No maintained Python parser for Engine's `m.db` beatgrid turned up. A user claims Engine's analysis is fast. — [Engine DJ: analysis speed test](https://community.enginedj.com/t/analysis-speed-test-engine-dj-is-the-winner-by-a-country-mile/57468)
- Engine staff referenced internal data ranking its BPM and first-downbeat detection near the top, but said they can't share it. — [Engine DJ: best analytical software](https://community.enginedj.com/t/best-analytical-software-for-bpm-key-downbeat-cues/40389)

**djay (Algoriddim)**: zplane lists djay 2/3/4 (Mac) and djay iPad as AUFTAKT licensees, at least historically. — [zplane technology](https://licensing.zplane.de/technology). Users complain about grids on non-strict-BPM music. — [Algoriddim community](https://community.algoriddim.com/t/beat-grid-music-that-is-not-strict-bpm/16037)

### Inferences
- For several hundred worship songs (often live-feel, slow, with gradual drift), rekordbox (Dynamic analysis) + XML export + pyrekordbox gives the most machine-readable beat-level output of any commercial tool found. Reading PQTZ via pyrekordbox gives every beat, not just change points.
- Batch here means drag the whole folder into the collection and analyze all, then parse. There is no headless CLI, so the run happens on a local Mac/PC GUI. This conflicts with a "compute on Kaggle only" policy and should be flagged.
- Serato and Traktor are parseable but second-tier: the formats are reverse-engineered, and Traktor favors constant-tempo grids.

### Gaps
- No official AlphaTheta doc on how Dynamic-mode grids appear in XML (one TEMPO per beat vs per change) was found. This needs an empirical check.
- Engine DJ, VirtualDJ, and djay export formats and parsers were not verified.
- No ToS clause was found that forbids using DJ-app analysis outputs for research. It was not checked.

## Q2. DAWs: Ableton Live, Cubase/Nuendo, Studio One, Melodyne, Reaper

### Takeaway
Ableton Live is the only DAW found with a scriptable API that returns beat positions: Live Object Model `Clip.warp_markers`, available since Live 11, readable from Max for Live or Remote Scripts. Cubase, Studio One, and Melodyne tempo detection are per-clip GUI operations with no documented batch path.

### Cited Findings
- LOM `Clip.warp_markers` (get/observe, audio clips only) returns warp markers as (sample time, beat time) pairs. Getting it is available since Live 11.0. `warping` and `warp_mode` are also exposed. — [Cycling '74 LOM: Clip](https://docs.cycling74.com/apiref/lom/clip/)
- `.asd` warp markers can be parsed offline with AbletonParsing (tested on Live 9/10). Live 12 uses a different binary format that the library does not yet support. — [DBraun/AbletonParsing](https://github.com/DBraun/AbletonParsing)
- In `.als` XML, warp markers look like `WarpMarker SecTime="…" BeatTime="…"`. This is a user interpretation, not official. — [Ableton forum](https://forum.ableton.com/viewtopic.php?p=1383377)
- Live reads the `.asd` once and caches it (2014 report). — [Ableton forum](https://forum.ableton.com/viewtopic.php?p=851855)
- zplane lists Ableton Live 5–9 as an AUFTAKT licensee, so Live's auto-warp historically used zplane beat tracking. Whether Live 10–12 still does is not stated. — [zplane technology](https://licensing.zplane.de/technology)
- Cubase's Tempo Detection panel builds a tempo track from audio in one click, but results "are not always as good as with a DIY approach". The workflow is Tempo Detection, then AudioWarp/Time Warp correction. — [Sound On Sound: Tempo Trap](https://www.soundonsound.com/techniques/tempo-trap); [Yamaha Synth forum](https://yamahasynth.com/community/montage-series-synthesizers/using-arps-alongside-audio-with-varying-tempo-in-cubase); [Steinberg forum](https://forums.steinberg.net/t/tempo-detection/671827)
- Studio One: Audio > Detect Tempo sets File Tempo to "Map" for variable tempo, and Extract to Tempo Track creates a tempo map. Sound On Sound says it "may or may not be successful". One user got 179 BPM for an ~85–93 BPM track (an octave error). — [Sound On Sound: Studio One tempo track](https://www.soundonsound.com/techniques/studio-one-tempo-track?amp); [VI-Control](https://vi-control.net/community/threads/tempo-detection-in-a-daw-maybe-studio-one.112986/)

### Inferences
- An Ableton batch is feasible but awkward: a Max for Live device or Remote Script loops over clips in a Set with auto-warp on, then dumps `warp_markers` to JSON. Auto-warp with default settings often places only a few markers, so the beat grid is interpolated between markers. Fine variable tempo needs "Warp From Here" variants, which is extra effort.
- Cubase, Studio One, and Melodyne are unsuitable for hundreds of songs without GUI automation. They are only useful as spot-check references.

### Gaps
- Melodyne tempo detection, Reaper (ReaScript + tempo detection plugins), and the iZotope tools were not researched. No sources were reached.
- Ableton "Tempo Follower" (Live 11+) follows live input in real time. It is not an offline analyzer, and no source was fetched.
- No accuracy numbers were found for any DAW's tempo detection.

## Q3. Commercial APIs / SDKs (zplane, Superpowered, Spotify, Cyanite, etc.)

### Takeaway
zplane AUFTAKT v4 is the most relevant commercial engine. It is DNN-based, outputs beats and downbeats, tracks abrupt tempo and meter changes, and has a documented command-line example plus free PC/Mac demo apps. Licensing requires contacting zplane. Superpowered gives only constant BPM + first-beat offset. Spotify Audio Analysis, which returned beats, bars, and tatums, is closed to new apps since 2024-11-27.

### Cited Findings
- AUFTAKT v4 claims improved tempo, beat, and downbeat detection, tracking of abrupt tempo changes, time-signature tracking, and multiple correction points. It is based on DNN + statistical models. The vendor claims >30% better detection rate across genres vs earlier versions (>40% on complex jazz) but gives no absolute accuracy figures. Demo apps v4.2.2 for PC/Mac exist. Licensing contact: info@zplane.de. — [zplane licensing: technology](https://licensing.zplane.de/technology)
- The AUFTAKT v4 SDK documentation (v4.3.0, 2025-02-19) includes a C++ usage example, a command-line usage example, and classes `zplane::aufTAKT`, `Beat`, `KnownDownbeat`. — [AUFTAKT v4 SDK documentation (PDF)](https://licensing.zplane.de/uploads/SDK/AUFTAKT/V4/manual/AUFTAKT_v4_sdk_documentation.pdf)
- Listed AUFTAKT users include Ableton Live 5–9, FL Studio, djay, Mixed In Key, Rekord Buddy, Resolume, and Soundminer. — [zplane technology](https://licensing.zplane.de/technology)
- The Superpowered `Analyzer` outputs `bpm`, `beatgridStartMs` (first beat), key, and loudness/waveforms. Its docs mention no downbeat or variable-tempo output. — [Superpowered Analyzer docs](https://docs.superpowered.com/reference/latest/analyzer); [Superpowered BPM/beat detection](https://superpowered.com/bpm-detection-key-detection-bar-detection-beat-detection-android-ios)
- Spotify Web API: from 2024-11-27, new apps cannot access Audio Features or Audio Analysis. Existing extended-mode apps are unaffected. — [Spotify developer blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api). New apps get 403s, and only apps with a pending quota extension before that date keep access. — [Spotify community](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/m-p/6916386/highlight/true). No reversal was found as of the search date.
- Cyanite returns BPM/tempo and key tags. No beat-timestamp output was found (third-party description only). — [aimusicpreneur: Cyanite](https://www.aimusicpreneur.com/ai-tools/cyanite/)
- Mixed In Key batch-analyzes and writes key, BPM, and energy into file tags. BPM is written as an integer in ID3 (user report). No beat grid or CSV export is documented. — [Mixed In Key: add key and BPM tags](https://mixedinkey.com/workflows/add-key-and-bpm-tags/); [DJTT forum](https://forum.djtechtools.com/t/mp3-files-oragnization-tips/75456)
- BytePlus offers a non-streaming beat detection SDK (commercial cloud vendor). Details were not reviewed. — [BytePlus beat detection SDK](https://docs.byteplus.com/en/audio-sdk/sdk-docs/non-streaming-beat-detection-sdk-guides-overview)

### Inferences
- AUFTAKT's demo app or SDK CLI could be a strong "commercial reference" in a comparison table, because it is the engine behind several DJ/DAW products and outputs beats + downbeats + tempo changes. Whether the free demo allows batch or file export needs hands-on testing. An SDK license (price undisclosed) is likely needed for headless batch runs.
- Spotify is unusable for a new research app. It also never covered unreleased or local worship recordings.
- Superpowered, Mixed In Key, and Cyanite give only global BPM, which is insufficient for beat-grid evaluation.

### Gaps
- zplane pricing, evaluation-license terms, and whether the demo app exports beat lists were not found.
- AudD, Tunebat, and Essentia commercial licensing (Essentia is AGPL, with a commercial license from UPF/MTG) were not verified in this pass. No URLs were reached.
- Elastique is zplane's time-stretch engine, not a detector. Its relevance is only that DAWs pair it with AUFTAKT (not sourced).

## Q4. Published accuracy evidence: commercial tools vs ground truth

### Takeaway
No peer-reviewed or independent benchmark comparing rekordbox, Serato, Traktor, Engine, or Mixed In Key against beat or tempo ground truth was found. Evidence is anecdotal forum posts, and they contradict each other. Research-system benchmarks exist (Schreiber et al.) but exclude commercial products. Any commercial comparison would have to be run in-house on the project's own annotated set.

### Cited Findings
- Forum anecdotes conflict. Some users rate Traktor's BPM above Serato's, others the reverse. Octave (half/double) errors and one-beat-off downbeats are reported for all apps. — [NI community](https://community.native-instruments.com/discussion/45283/track-bpms-are-accurate-after-analyzing); [DJTT: Traktor BPM analysis error](https://forum.djtechtools.com/t/traktor-bpm-analysis-error/13655); [Engine DJ: beat detection very poor](https://community.enginedj.com/t/beat-detection-very-poor/28942)
- Engine DJ claims internal data favoring its BPM/downbeat accuracy but does not publish it. — [Engine DJ community](https://community.enginedj.com/t/best-analytical-software-for-bpm-key-downbeat-cues/40389)
- Schreiber, Urbano & Müller, "Music Tempo Estimation: Are We Done Yet?" (TISMIR 2020): a review of metrics and datasets, with public estimates from many research systems (not commercial). — [FAU CRIS](https://cris.fau.de/publications/318613998); [TISMIR](https://transactions.ismir.net/articles/189)
- Schreiber & Müller (ISMIR 2018) crowdsourced EDM tempo: systems perform better than previously thought, and evaluation quality needs improving. — [DancePedia summary](https://scrapbox.io/DancePedia/A_Crowdsourced_Experiment_for_Tempo_Estimation_of_Electronic_Dance_Music)
- 2026 preprint "The SMC Blind Spot": on expressive/hard material (SMC), beat placement and metrical coherence are independent failure modes for SOTA beat trackers. This is relevant to slow, rubato worship intros. — [arXiv 2605.12287](https://arxiv.org/pdf/2605.12287)
- Böck & Davies (2014) on beat-tracking evaluation measures. — [JKU research](https://research.jku.at/en/publications/evaluating-the-evaluation-measures-for-beat-tracking/)

### Inferences
- Proposed ranking for this pipeline (ease of bulk BPM + beats × evidence):
  1. **rekordbox** (Dynamic analysis → XML TEMPO / ANLZ PQTZ via pyrekordbox): best beat-level bulk export, free app. Accuracy is unpublished.
  2. **Ableton Live 11/12** (M4L/Remote Script dump of `Clip.warp_markers`): scriptable but needs custom device. Marker density depends on auto-warp.
  3. **zplane AUFTAKT v4** (demo / licensed SDK CLI): richest output (beats, downbeats, tempo and meter changes). Licensing friction, no public accuracy numbers.
  4. **Serato** (GEOB via serato-tools) / **Traktor** (collection.nml): parseable, weaker variable-tempo support or undocumented formats.
  5. **Superpowered SDK**: constant BPM + first beat only.
  6. **Mixed In Key / Cyanite**: BPM tag only.
  7. **Cubase / Studio One / Melodyne**: per-song GUI, not batchable.
  8. **Spotify Audio Analysis**: closed to new apps (since 2024-11).
- All GUI-based tools (1–4, 7) require local execution, which conflicts with the project's Kaggle-only compute rule. The AUFTAKT SDK on Linux, if licensed, is the only commercial option plausibly runnable on Kaggle (platform support unverified).

### Gaps
- No independent accuracy study of any commercial DJ/DAW tempo detector was found. MIREX has no commercial entries that I could locate.
- Logic Smart Tempo vs these tools: no head-to-head source found.
