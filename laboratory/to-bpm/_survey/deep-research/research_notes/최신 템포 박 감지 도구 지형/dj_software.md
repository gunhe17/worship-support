# DJ software and DJ-oriented analysis tools as bulk BPM + beat-grid sources (as of 2026-10)

Scope note: this builds on `research_notes/Logic 템포 감지 배치 활용/commercial_alternatives.md` (call it "prior note") and goes deeper on storage formats, parsers, and variable tempo. It took about 21 search/fetch calls. Several vendor pages were not reached: rekordbox 7 manual, Traktor 4 manual, djay docs, Mixed In Key docs, Lexicon docs. Claims without a URL are in Gaps.

## Q1. rekordbox 7.x: Dynamic analysis, ANLZ PQTZ/PQT2, master.db via pyrekordbox, XML TEMPO, CLI, free tier

### Takeaway
rekordbox is still the best DJ-app source of per-beat timestamps. Every analysed track gets an ANLZ `.DAT` file whose PQTZ tag lists every beat as (beat-in-bar, tempo ×100, time in ms). pyrekordbox (MIT) parses it and lists rekordbox 7.0.9 as tested. Dynamic analysis mode is the variable-tempo path. Analysis is GUI-only, and per-beat time resolution is 1 ms.

### Cited Findings
- rekordbox lets users pick an analysis method, [Normal] or [Dynamic]. — [rekordbox.com DJing features](https://rekordbox.com/en/feature/djing/)
- Training material says Dynamic mode detects tempo variations and adjusts the beat grid per section, and recommends it for less regular rhythms (funk, rock, live drummers). Normal mode suits fixed-tempo drum-machine music. — [Elephorm: paramétrage avancé de l'analyse (rekordbox 7)](https://www.elephorm.com/formation/maitriser-rekordbox-7/parametrage-avance-de-lanalyse-dans-rekordbox); [Elephorm: importer et analyser (rekordbox 7)](https://www.elephorm.com/formation/maitriser-rekordbox-7/importer-et-analyser-des-morceaux-dans-rekordbox)
- A user blog says Normal mode gives bad grids on tracks with BPM changes, human drummers, or older recordings. It also says Dynamic is set globally in preferences but can be applied to a single track from a menu. — [reallychrism substack](https://reallychrism.substack.com/p/the-export-mode-button-that-saved)
- **PQTZ (in `.DAT`)**: the header gives `len_beats`. Each entry has `beat_number` (2 bytes, beat in bar 1–4), `tempo` (2 bytes, BPM × 100, so 0.01 BPM resolution), and `time` (4 bytes, milliseconds). — [pyrekordbox: Analysis Files Format](https://pyrekordbox.readthedocs.io/en/latest/formats/anlz.html)
- **PQT2 (in `.EXT`, not `.2EX`)**: the "extended (nxs2) beat grid". It holds two full beat-grid entries (first and last) in PQTZ format, an `entry_count` that is "almost always" equal to the PQTZ count, and 2-byte "main entries" whose format is unknown. The `.2EX` file holds waveform tags (PWV6/PWV7/PWVC). — [pyrekordbox: Analysis Files Format](https://pyrekordbox.readthedocs.io/en/latest/formats/anlz.html)
- Usage: `get_tag("PQTZ")` / `"beat_grid"` returns the beat times. — [pyrekordbox ANLZ tutorial](https://pyrekordbox.readthedocs.io/en/stable/tutorial/anlz.html)
- pyrekordbox is MIT-licensed. The README lists tested rekordbox versions "5.8.6 | 6.7.7 | 7.0.9". `master.db` is SQLCipher-encrypted, and the key must be available on the machine running rekordbox. PWV6/PWV7/PWVC are the only ANLZ tags listed as unsupported. — [pyrekordbox GitHub](https://github.com/dylanljones/pyrekordbox); [pyrekordbox docs](https://pyrekordbox.readthedocs.io/en/latest/)
- `rbox` (from the prior note) also reads master.db and exposes `get_beat_grid()` (beat number, tempo, time). — [rbox on PyPI](https://pypi.org/project/rbox/)
- **XML export `TEMPO`**: `Inizio` (float64 seconds), `Bpm` (float64), `Metro` (string, e.g. "4/4"), `Battito` (sint32 beat-in-bar). A track can have more than one TEMPO element. Example: `<TEMPO Inizio="0.232" Bpm="172.00" Metro="4/4" Battito="1"/>`. The docs do not explain how multiple elements map to dynamic grids. — [pyrekordbox XML format](https://pyrekordbox.readthedocs.io/en/latest/formats/xml.html)
- The XML only carries grids and BPM change points if "BPM change points" is enabled under Preferences > Advanced. — [Mixed In Key workflow](https://mixedinkey.com/workflows/export-cue-points-to-rekordbox/) (via prior note)
- Cloud analysis: rekordbox can fetch analysis results (BPM, beat grid, waveforms, vocal positions) from an AlphaTheta server when online, to cut analysis time. An older FAQ calls it a free beta that may become a paid feature. — [rekordbox FAQ (plans)](https://www.rekordbox.com/en/support/faq/plans/)
- Plans: in a March 2025 notice, AlphaTheta suspended new Core and Creative subscriptions with no resumption date. — [rekordbox: new subscriptions and partial plan changes (2025-03)](https://rekordbox.com/en/2025/03/new-subscriptions-and-partial-plan-changes/)
- The rekordbox 7 public beta was covered by Digital DJ Tips. — [Digital DJ Tips: First look at rekordbox 7 public beta](https://www.digitaldjtips.com/rekordbox-7-public-beta/)

### Inferences
- The lowest-friction batch path: import the folder → analyse all in Dynamic mode → read `PIONEER/USBANLZ/.../ANLZ0000.DAT` with pyrekordbox's `AnlzFile` → PQTZ gives every beat time (ms) and downbeats (`beat_number == 1`). This path does not need master.db decryption. master.db (or the XML) is only needed to map ANLZ paths to audio files.
- The 1 ms quantisation is fine for beat F-measure (±70 ms window) but noticeable for sub-ms onset analysis.
- Cloud analysis may return grids that were not computed locally, which would confound an accuracy test. Run offline or with the feature disabled when benchmarking (assumption; the setting was not located).

### Gaps
- No official doc or CLI was found for triggering analysis. I found no evidence of command-line analysis, so it appears GUI-only.
- How Dynamic grids appear in the XML (one TEMPO per beat, or per change point) is unconfirmed. Needs an empirical check.
- The latest pyrekordbox release number and the status of master.db key extraction for rekordbox ≥7.1 were not confirmed. The README only lists 7.0.9 as tested.
- The rekordbox 7 free-tier analysis limits were not found. No source shows an analysis cap on the Free plan.
- No rekordbox EULA clause on automated or research use was checked.

## Q2. Serato DJ: BeatGrid GEOB tag and parsers

### Takeaway
Serato stores a compact piecewise-constant grid as markers in the audio file's tags, not a list of beats. Beat times have to be reconstructed by interpolation. The format is reverse-engineered but fully specified, and parsers exist (serato-tools, triseratops).

### Cited Findings
- `Serato BeatGrid` GEOB layout: header `01 00` + uint32 marker count; N non-terminal markers (float32 position, uint32 beats-until-next-marker); one terminal marker (float32 position, float32 BPM); a one-byte footer ("apparently random"). "The last beatgrid marker always has to be a terminal one." — [Holzhaus/serato-tags: serato_beatgrid.md](https://github.com/Holzhaus/serato-tags/blob/main/docs/serato_beatgrid.md)
- Holthuis's original reversing post found BeatGrid "inconclusive" at the time and put the track BPM in `Serato Autotags`. — [Reversing Serato's GEOB tags](https://homepages.rub.de/jan.holthuis/reversing-seratos-geob-tags.html)
- serato-tools (Python, v4.0.1, 2026-02-27) reads and writes beat grids. — [piwheels: serato-tools](https://www.piwheels.org/project/serato-tools/) (prior note)
- Now Playing decodes the beat-grid GEOB, including mid-track tempo changes. — [Now Playing Serato integration](https://help.nowplayingapp.com/reference/integrations/serato/)
- A Digital DJ Tips headline says "Serato Fixes Its Beatgrids In DJ 5.0 Beta". No details were retrieved. — [Digital DJ Tips: Advanced beatgridding](https://www.digitaldjtips.com/advanced-beatgridding-flexible-dynamic-elastic-how-to-do-it/)

### Inferences
- Beat times come from interpolation: between markers i and i+1, beats are evenly spaced (`(pos_{i+1}-pos_i)/beats_i`). After the terminal marker they are spaced at 60/BPM. Variable tempo is representable, but whether Serato's auto-analysis creates multiple markers was not verified. Its "dynamic" grids may be mostly user-edited.
- The position unit is not specified in the spec. Community parsers treat it as seconds (unverified here).

### Gaps
- Whether Serato DJ Pro/Lite (2026) auto-detects variable tempo, and whether Serato DJ Lite (free) can bulk-analyse, were not confirmed.
- Serato's ToS on automated use was not checked.

## Q3. Traktor Pro 4: collection.nml and flexible beatgrids

### Takeaway
Traktor Pro 4 (July 2024) added "Flexible Beatgrids": multiple tempo zones per track. They are a manual editing feature. Auto-analysis sets only the first marker. Traktor is a poor source of automatic variable-tempo beats.

### Cited Findings
- Flexible beatgrids let users define multiple tempo zones per track, for looping, beat jumps, effects, and mixing tracks with changing tempo. — [NI press: Traktor Pro 4](https://www.native-instruments.com/fr/press-area/djing/traktor-pro-4/); [Sonicstate](https://sonicstate.com/amped/2024/07/18/ni-introduces-traktor-pro-4/)
- NI guidance: the first marker is set automatically during analysis. The user places the second marker at the last beat of the first steady zone, with SNAP on. NI acknowledged a bug where adding a marker changed the tempo of the zone to its left. — [NI community: flexible beat grid issue](https://community.native-instruments.com/discussion/33458/traktor-pro-4-flexible-beat-grid-issue); [NI community comment](https://community.native-instruments.com/discussion/comment/166634)
- Users report the first marker's BPM drifting (137 → 137.010) after a second marker is added. A helper said this is by design, to avoid phase skips. — [NI community](https://community.native-instruments.com/discussion/34321/traktor-pro-4-flexible-beatgridding-beats-to-cue-issue)
- A reviewer says the flexible-grid workflow is placing markers by hand where the tempo shifts. — [We Are Crossfader: Traktor Pro 4 review](https://wearecrossfader.co.uk/blog/traktor-pro-4-review/)
- Grids live in `collection.nml`. Whether they are also written into file tags is disputed. — [DJTT forum](https://forum.djtechtools.com/t/traktor-what-saves-where-questions/23522) (prior note)
- "Elastic beatgrids" (pre-Traktor 4) was a community conversion technique from rekordbox Dynamic grids, not an NI feature. — [dj-kb: Traktor Elastic Beatgrids](https://dj-kb.readthedocs.io/traktor_elastic_beatgrids/)

### Inferences
- For batch use, Traktor gives one auto grid (BPM + anchor), which is equivalent to constant tempo. It is not useful for drifting worship recordings unless grids are hand-edited.
- `collection.nml` is plain XML. Parsing is trivial, but the multi-marker schema (CUE_V2 TYPE=4 grid markers, by community convention) was not verified.

### Gaps
- No official NML schema doc or Traktor 4.x release note was found that confirms auto-detection of tempo changes. The 4.2.0 notes were listed but not read ([NI community](https://community.native-instruments.com/discussion/comment/225138)).

## Q4. Engine DJ: SQLite database, beat data, libdjinterop

### Takeaway
Engine DJ stores its library in SQLite (`m.db`) with compressed blobs. libdjinterop (LGPL-3.0, C++) supports beat grids for Engine DJ Desktop up to 4.3.0 and OS up to 4.3.3. Engine's grids are reported to assume constant tempo, and it tends to reanalyse imported grids.

### Cited Findings
- libdjinterop supports Engine DJ OS 1.0.3–4.3.3 and Engine DJ Desktop 1.0.1–4.3.0 (Engine Library format only). It lists "Beat grids" as supported. License LGPL-3.0. — [xsco/libdjinterop](https://github.com/xsco/libdjinterop)
- Engine's PerformanceData blobs (e.g. quickCues) are zlib-compressed with an 8-byte header. A 2021 community doc no longer matches the current layout, which suggests the format drifts between versions. — [Engine DJ community: decoding quickCues BLOB](https://community.enginedj.com/t/help-needed-decoding-engine-dj-hotcue-format-quickcues-blob/66222)
- With a rekordbox USB, Engine "won't use existing beatgrid data, it reanalyses the tracks and assumed they have a constant tempo". Users import rekordbox XML to keep grids. — [Engine DJ community: automatic BPM jump](https://community.enginedj.com/t/automatic-bpm-jump-from-rekordbox-library/64189)
- Engine DJ user guide v2.3.0: Beatgrid Lock prevents alteration, but grids "may be overwritten from Engine OS players even if they have been locked". — [Engine DJ User Guide v2.3.0 PDF](https://cdn.inmusicbrands.com/engine/Engine%20DJ%20-%20User%20Guide%20-%20v2.3.0.pdf)
- Users report that Engine's analysis is fast. Staff claim internal accuracy data but have not published it. — [speed test thread](https://community.enginedj.com/t/analysis-speed-test-engine-dj-is-the-winner-by-a-country-mile/57468); [best analytical software thread](https://community.enginedj.com/t/best-analytical-software-for-bpm-key-downbeat-cues/40389) (prior note)
- A third-party "engine-dj-mcp" server exists for querying Engine libraries. Not evaluated. — [mcpservers.org: engine-dj-mcp](https://mcpservers.org/servers/venut-technologies/engine-dj-mcp)

### Inferences
- Engine is parseable (libdjinterop), but its auto grids appear to be constant tempo, and the format churns across versions. It ranks below rekordbox for variable-tempo work.

### Gaps
- The exact beat-data blob schema (sample-offset markers + beat index) was not retrieved from the libdjinterop source.
- No Engine DJ 4.x feature for automatic variable-tempo analysis was confirmed.

## Q5. VirtualDJ, djay Pro, Mixxx, Lexicon / Rekord Buddy, Mixed In Key

### Takeaway
Mixxx is the only open-source option. It stores beats in `mixxxdb.sqlite` as a protobuf (`BeatMap` = list of frame positions, or `BeatGrid` = BPM + first beat), but analysis is GUI-triggered with no documented headless mode. VirtualDJ stores BPM as a seconds-per-beat value in `database.xml`. djay and Mixed In Key have no documented beat-list export. Lexicon converts beat grids between the five big apps, but whether it preserves variable grids is unverified.

### Cited Findings
**Mixxx**
- `beats.proto` (package `mixxx.track.io`) defines `Beat` (frame position, enabled flag, source = analyzer/file-metadata/user), `Bpm` (double + source), `BeatMap` (repeated Beat), and `BeatGrid` (optional Bpm + first Beat). — [mixxx src/proto/beats.proto](https://raw.githubusercontent.com/mixxxdj/mixxx/main/src/proto/beats.proto)
- History: a 2011 dev note said the "grid is defined by the BPM and first-beat" and that non-fixed-tempo beat grids (BeatMap) would be experimental in 1.11. — [Launchpad merge: features_trackbeats](https://code.launchpad.net/~mixxxdevelopers/mixxx/features_trackbeats/+merge/49371)
- Analysis runs on first deck load, or as a batch in the GUI's Analyze view ("All" → Analyze). It computes beat grid, key, ReplayGain, and waveforms, and is CPU-heavy. — [Mixxx manual: Getting Started](https://github.com/mixxxdj/manual/blob/main/source/chapters/getting_started.rst); [Mixxx 2.6 manual](https://manual.mixxx.org/2.6/pl/chapters/getting_started)
- The `mixxx(1)` man page lists only a few CLI flags (locale, fullscreen, help). No analyse-only flag. The library is `mixxxdb.sqlite`, and waveforms are in `~/.mixxx/analysis`. — [Debian man page mixxx.1 (trixie)](https://dyn.manpages.debian.org/trixie/mixxx/mixxx.1.en.html)

**VirtualDJ**
- The `database.xml` `Scan` element stores `Bpm` as "the time (in seconds) between 2 beats", so BPM = 60 / value. `AltBpm` is the second-most-likely BPM. `Poi` entries have Pos/Type/Point/Bpm attributes. — [VirtualDJ wiki: VDJ_database](https://www.virtualdj.com/wiki/VDJ_database.html)
- VirtualDJ's BPM Editor lets users adjust and re-analyse beat-grid markers (manual). — [Digital DJ Tips: Advanced beatgridding](https://www.digitaldjtips.com/advanced-beatgridding-flexible-dynamic-elastic-how-to-do-it/)

**djay Pro (Algoriddim)**
- zplane historically listed djay as an AUFTAKT licensee. Users complain about grids on non-strict-BPM music. — [zplane technology](https://licensing.zplane.de/technology); [Algoriddim community](https://community.algoriddim.com/t/beat-grid-music-that-is-not-strict-bpm/16037) (prior note)
- Community thread on converting cues and beat grids from Serato to djay and rekordbox. — [Algoriddim community](https://community.algoriddim.com/t/convert-cues-beatgrids-more-from-serato-to-djay-and-rekordbox/5364)

**Lexicon DJ / Rekord Buddy / rekordcloud**
- A rekordcloud blog (competitor) says Lexicon converts between rekordbox, Serato, Engine, Traktor, and VirtualDJ, including beat grids. — [rekordcloud blog](https://rekord.cloud/blog/lexicon-still-the-best-in-conversion)
- An Engine user says Lexicon copies the complete library, "beatgrids and all". — [Engine DJ community](https://community.enginedj.com/t/the-beatgrids-are-mostly-out-of-whack/63193)
- Conversion pitfall: in a small percentage of MP3s, 26 or 50 ms of silence is added at the start on one side, which shifts grids. This happens only when converting between systems. — [rekordcloud wiki: convert library](https://Rekord.cloud/wiki/convert-library)
- Rekord Buddy (Traktor ↔ rekordbox converter) appears in djworx coverage. zplane lists it as an AUFTAKT user. — [djworx](https://djworx.com/?p=9113); [zplane technology](https://licensing.zplane.de/technology)

**Mixed In Key**
- It writes key, BPM, and energy to tags. BPM is reportedly an integer in ID3. No beat-grid export is documented. — [Mixed In Key workflows](https://mixedinkey.com/workflows/add-key-and-bpm-tags/) (prior note)

### Inferences
- Mixxx is the only tool here that might plausibly run on Kaggle-like Linux. It would need either a virtual display (xvfb) driving the GUI, or a small C++ harness linking Mixxx's analyzer classes. Both are custom work, not a supported feature. For research use, calling the underlying detector directly (Queen Mary / Vamp, which Mixxx historically used per the features_vamp branch) is simpler than driving Mixxx. That claim is not verified in this pass.
- Mixxx `BeatMap` stores every beat as a frame position, the same per-beat granularity as rekordbox PQTZ but at sample resolution. The protobuf blob is decoded with the `.proto` file directly.
- Lexicon is a convenience bridge (e.g. Serato → rekordbox XML), not an analyser. Grids pass through, and each hop risks a 26–50 ms MP3 offset.

### Gaps
- Mixxx 2.5/2.6 default beat detector and whether its auto-analysis produces BeatMap (variable) or BeatGrid (constant) by default were not confirmed from source.
- djay Pro beat-grid storage location and format: not found.
- VirtualDJ variable-BPM support and the beat-grid Poi format: not found on the wiki page.
- Lexicon's handling of variable or dynamic grids, and its pricing: not found from Lexicon's own docs.
- Mixed In Key 11 output details: not verified.

## Q6. Independent accuracy evidence and overall ranking

### Takeaway
No independent, ground-truth benchmark of DJ-software beat grids was found. Only forum anecdotes and vendor claims exist (as in the prior note). Ranking by ease of getting per-beat timestamps in batch: rekordbox ≫ Mixxx > Serato > Engine > Traktor > VirtualDJ > djay / Mixed In Key.

### Cited Findings
- Digital DJ Tips' "Advanced beatgridding" piece describes dynamic/flexible gridding only generally: "some software" offers it, and "some software doesn't have this at all". There is no measured accuracy. — [Digital DJ Tips](https://www.digitaldjtips.com/advanced-beatgridding-flexible-dynamic-elastic-how-to-do-it/)
- Forum anecdotes conflict across apps, with octave and off-by-one-downbeat errors reported everywhere. — [NI community](https://community.native-instruments.com/discussion/45283/track-bpms-are-accurate-after-analyzing); [Engine DJ: beat detection very poor](https://community.enginedj.com/t/beat-detection-very-poor/28942) (prior note)
- Users recommend analysing unsteady tracks in rekordbox's "high accuracy dynamic option" and importing elsewhere, which implies rekordbox Dynamic is seen as the best auto variable-tempo grid among DJ apps (anecdotal). — [Engine DJ community](https://community.enginedj.com/t/the-beatgrids-are-mostly-out-of-whack/63193); [dj-kb](https://dj-kb.readthedocs.io/traktor_elastic_beatgrids/)

### Inferences — ranking (ease of per-beat timestamps in batch)
| Rank | Tool | Batch trigger | Variable tempo (auto) | Output to parse | Parser / licence | Precision | OS / price |
|---|---|---|---|---|---|---|---|
| 1 | rekordbox 7 | GUI "analyse all" | Yes (Dynamic mode) | ANLZ `.DAT` PQTZ per-beat list; XML TEMPO | pyrekordbox (MIT), rbox | 1 ms; 0.01 BPM | Mac/Win; free plan exists (limits unverified) |
| 2 | Mixxx | GUI Analyze view | Possibly (BeatMap exists, default unverified) | `mixxxdb.sqlite` protobuf blob | `.proto` in repo (GPL app) | sample frames | Mac/Win/Linux; free |
| 3 | Serato DJ | GUI analyse | Representable; auto unclear | GEOB `Serato BeatGrid` markers | serato-tools, triseratops | float32 | Mac/Win |
| 4 | Engine DJ | GUI | Reported constant-tempo | SQLite `m.db` blobs | libdjinterop (LGPL-3.0, C++) | unverified | Mac/Win |
| 5 | Traktor Pro 4 | GUI Analyze | No (manual flexible grid) | `collection.nml` XML | trivial XML | unverified | Mac/Win; paid |
| 6 | VirtualDJ | GUI | Unverified | `database.xml` Scan Bpm (s/beat) | XML | unverified | Mac/Win |
| 7 | djay Pro / Mixed In Key | GUI | Unverified / No | none documented / tag BPM | — | integer BPM (MIK) | — |
- All of these need a local GUI run, which conflicts with the project's Kaggle-only compute rule. That is fine only if a human runs the GUI step once and the parsing is done afterwards.
- Because no public accuracy data exists, any use of DJ-app grids as a "reference" must be validated against the project's own annotated set.

### Gaps
- No peer-reviewed or blind-test comparison (DJ TechTools, Digital DJ Tips, ISMIR) of rekordbox, Serato, Traktor, Engine, Mixxx, or djay beat-grid accuracy was found.
- No ToS or EULA clause on automated or research use was verified for any of these apps.
