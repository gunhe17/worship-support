# Getting Logic Pro Smart Tempo results out of Logic as machine-readable files

Scope: export paths for the detected tempo map, beat and bar positions, downbeats and time signature; how precise they are; and how to turn them into beat times in seconds for comparison against beat-tracking ground truth. Research date: 2026-10-14. Apple's current Mac guide pages mostly returned only navigation when fetched, so many quotes come from archived 10.1, 10.4 and 9.1.6 guide pages. That version dependency is flagged wherever it matters.

## 1. Can a MIDI file export (File > Export > Selection as MIDI File) carry the Smart Tempo map?

### Takeaway
The only documented first-party path is File > Export > Selection as MIDI File, which writes a Format 1 SMF. Apple's documentation never says outright that the export includes tempo and signature meta-events. Users report mixed results, and one old Logic 8 report says the export contained no tempo. The tempo map's precision is limited by what reaches the Tempo track, which is set by the "Export Tempo Resolution" setting (Smoothed vs. Beats). Smart Tempo's internal beat markers are never exported directly.

### Cited Findings
- Menu path: "Select all of the MIDI regions you want to save. Choose File > Export > Selection as MIDI File… The selected MIDI regions are saved as a Format 1 MIDI file." — [Logic Pro 10.1 guide: Export MIDI regions](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcpdf6a3851.html)
- Format 0 export of a single region requires enabling a checkbox in Preferences > General > Project Handling. — [Logic Pro 10.1 guide](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcpdf6a3851.html); [Logic 9.1.6 manual ch.32 §4](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_32_section_4.html)
- Apple lists "Tempo changes" among the data an SMF can hold. An *import* ignores global data ("tempo events, signatures, chords, track names, SMPTE start…"); you must *open* the MIDI file to load tempo and signatures. The export section does not say whether tempo or signature are written. — [Logic 9.1.6 manual ch.32 §4](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_32_section_4.html)
- Current Apple article exists: "Export MIDI regions as MIDI files in Logic Pro for Mac". Its body could not be retrieved via fetch. — [Apple Support](https://support.apple.com/guide/logicpro/export-midi-regions-lgcp77376cad/mac)
- The iPad version has the same "Export Selection as MIDI File" command. — [Logic Pro for iPad guide: Export MIDI tracks as a MIDI file](https://support.apple.com/guide/logicpro-ipad/lpip53ffa1a7/ipados)
- User reports conflict:
  - A Logic 8 user said a Logic-exported MIDI file had no tempo or time-signature changes when imported into Pro Tools. — [Logic Users Group, Logic 8 thread](https://logic-users-group.com/threads/exporting-tempo-map-time-signatures.991/)
  - A Logic 10.3 user said tempo and markers imported correctly into Pro Tools but the timecode was offset, apparently because Logic's SMPTE position for bar 1 had been changed. — [Logic Users Group: SMPTE sync issue](https://logic-users-group.com/threads/smpte-sync-issue-when-exporting-midi-from-logic-to-pro-tools.10531/)
  - A Steinberg forum user says a tempo map saved from Logic "is basically a MIDI file" containing MIDI and tempo map info, and opens fine in Pro Tools. — [Steinberg forum](https://forums.steinberg.net/t/tempo-map/609387)
- A Steinberg forum user says Logic writes SMFs with a PPQN division and no SMPTE frame-rate header. — summarized in search results for [Steinberg: Logic and Dorico workflow](https://forums.steinberg.net/t/logic-and-dorico-workflow/126489?page=2). The page itself was not fetched; treat as unverified.
- **Export Tempo Resolution** (Smart Tempo project settings): "Choose the resolution of the exported tempo." "Smoothed: Exports a tempo that smoothes out jumps in tempo from beat to beat." "Beats: Exports the tempo information at each beat without any smoothing." — [Logic 10.4 guide: Smart Tempo project settings](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp6ad7156e.html)
- Logic 10.4.2 release note: "It is now possible to export from the File Tempo Editor in Beat resolution." — [KVR: Logic 10.4.2 release notes](https://www.kvraudio.com/news/apple-releases-logic-v10-4-2-42678)
- An Apple Community user recommends setting the resolution to Beats while editing, then thinning or averaging later. — [Apple Discussions (via search)](https://discussions.apple.com/thread/252696721). This is user advice, not Apple guidance.
- Flex & Follow import options "On + Align Bars and Beats" place tempo events at every beat where a change is detected. "On + Align Bars" places them per bar. — [Logic 10.4 guide: Smart Tempo project settings](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp6ad7156e.html); [Sound On Sound: Using Smart Tempo](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo?amp)
- Adapt mode writes tempo changes into the global Tempo track, shown blue where Smart Tempo has mapped. — [Sound On Sound: Using Smart Tempo](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo?amp)
- "Apply Region Tempo to Project Tempo… writes the analyzed tempo from the selected region to the Tempo track" and aligns the region to the downbeat. — [Logic 10.4 guide: Smart Tempo overview](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)

### Inferences
- "Export" in the Export Tempo Resolution setting most likely means exporting Smart Tempo analysis into the project Tempo track (Adapt / Apply Region Tempo), not exporting to a file. To get beat-level detected tempo into the Tempo track, use Adapt mode with Flex & Follow set to "On + Align Bars and Beats" and Export Tempo Resolution set to "Beats". Then each detected beat becomes one tempo event.
- With per-beat tempo events in the Tempo track, an SMF tempo map is equivalent to a beat list: beat k sits at integer quarter-note tick k·PPQ, and its time is the cumulative sum of segment durations. In "Smoothed" mode, beat times are only approximated.
- Practical way to force tempo into the SMF: create a MIDI region (even nearly empty) spanning the whole song, select it, and run Export > Selection as MIDI File. Then check the file for `set_tempo` and `time_signature` meta messages with mido. This trick is not documented by Apple (see Gaps).
- Precision: SMF tempo resolution is integer microseconds per quarter note. Positions are ticks at Logic's PPQ (960 internally, per §3). This is far finer than beat-tracking tolerances (±70 ms F-measure window). The real error source is how Smart Tempo quantizes and smooths into the Tempo track, not the file format.

### Gaps
- No primary source confirms whether a current Logic (11.x / 12.x) MIDI export writes the global tempo and signature tracks, or what PPQ division the SMF header uses. A one-time local test is needed: export, then `mido.MidiFile(...).ticks_per_beat` and dump the meta messages.
- No source documents an "Export Global Tracks / Tempo List as file" command in current Logic.
- No source covers whether the Smart Tempo Editor's beat markers can be written to a file directly, without going through the Tempo track.

## 2. AAF, FCPXML, ADM, project export and audio-file metadata (Apple Loops, tempo saved into audio files)

### Takeaway
Logic stores Smart Tempo analysis and edits as tempo information inside the source audio file, in an undocumented proprietary chunk. It can also write the project tempo into an audio file. No public spec or parser for that chunk was found. No source found on whether AAF, FCPXML or ADM exports carry the tempo map.

### Cited Findings
- Smart Tempo Editor edits "do not alter the audio data in the source audio file, but only the tempo information Logic Pro… uses to conform (flex) the file to the project tempo." — [Apple Logic Pro guide (Smart Tempo Editor)](https://support.apple.com/ar-qa/guide/logicpro/lgcp2a428fed/mac); [10.4 version](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp2a428fed.html)
- "Edit Smart Tempo is only available if the audio file the region refers to contains tempo information; if unavailable, Analyze Tempo first." The iPad guide also lists a **Write Project Tempo to Audio File** command and a command that removes all tempo information from the file. — [Logic Pro for iPad guide: Use Smart Tempo](https://support.apple.com/guide/logicpro-ipad/lpip99743e51/3.0/ipados/26). Taken from search snippets; the page body could not be fetched.
- For MIDI regions, "the Smart Tempo analysis and any edits you make in the Smart Tempo Editor are saved directly to the MIDI regions" and stored with the project. — [Logic 10.4 guide: Smart Tempo overview](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)
- Legacy behavior: "When you record or bounce an audio file, the current Tempo List is added to the file. You can then use the saved tempo information for importing or exporting purposes." Older menu commands, quoted from search snippets: Import Tempo Information from Audio File; Remove Tempo Information from Audio File; Export Tempo Information to Audio File. — [Logic 10.1 guide](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcp31b25732.html); [Logic 9.1.6 manual ch.18](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_18_section_5.html)
- A bounced file follows project tempo only if "Add resulting files to Project Audio Browser" is enabled. PCM bounce formats are AIFF, Broadcast Wave and CAF. — [Logic 10.1 guide: bounce PCM options](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcpb7e35135.html)
- Many commercial audio files carry tempo tags. To make Smart Tempo reanalyse them, first strip the tags with Edit > Tempo > Remove Tempo Information. — [Sound On Sound: Using Smart Tempo](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo?amp)
- Smart Tempo Editor menu functions: reanalyse, apply region tempo to project or project tempo to region, extend tempo changes, remove tempo edits from file. Also x2 and /2 buttons that double or halve the detected tempo. — [Apple: Match the tempo automatically in Logic Pro for Mac (HT208458 / 102165)](https://support.apple.com/en-au/102165)
- CAF is a chunked container that supports markers, annotations and metadata, with an edit-count link between metadata and audio. Apple's QA1527 describes Instrument and Region chunks with markers. Neither documents a Logic tempo or beat chunk. — [Apple CAF spec overview](https://developer.apple.com/library/mac/documentation/musicaudio/Reference/CAFSpec/CAF_overview/CAF_overview.html); [Apple QA1527](https://developer.apple.com/library/archive/qa/qa1527/_index.html)
- A Loopy Pro forum user notes that `afinfo` does not show transient or beat data in Apple Loops. — [Loopy Pro forum](https://forum.loopypro.com/discussion/comment/767295/)

### Inferences
- The tempo info Logic writes into WAV, AIFF or CAF is not readable with standard tools (`afinfo`, standard chunk parsers). Treat it as a black box unless someone hex-diffs a file before and after Analyze Tempo. It is not a practical extraction path for batch evaluation.
- The more practical route is to get Smart Tempo's result into the project Tempo track (Adapt or Apply Region Tempo, Beats resolution), then extract it from SMF (§1) or from ProjectData (§3).

### Gaps
- Chunk names and layout of Logic's in-file tempo data: no reverse-engineering write-up found. The task suggested AIFF `basc`/`trns` and CAF beat chunks, but no source found tying them to Smart Tempo.
- AAF, FCPXML and Dolby Atmos ADM exports: no source found on whether tempo or beat data is included.
- No current (11.x / 12.x) Mac guide text could be fetched for "Write Project Tempo to Audio File". Its existence on Mac is inferred from the iPad guide and older Mac docs.

## 3. Can the .logicx package (ProjectData) be parsed?

### Takeaway
Yes, partially, through community reverse engineering. **jonkubis/LogicProFormatWriter** (MIT, Python package `logicx`) documents the tempo and meter encoding in ProjectData: 960 PPQ, tempo stored as uint32 BPM×10000, 32-byte tempo events. That is enough to read a tempo map back into beat times. It is version-specific: its fixtures are Logic 11.2.2 / 12.0.1.

### Cited Findings
- LogicProFormatWriter: "Logic Pro's project file is an undocumented little-endian binary blob (Alternatives/000/ProjectData). This library reverse-engineers it…" It writes tempo, meter, markers, and audio and MIDI regions. MIT license. "Reverse-engineered against a specific Logic Pro version's ProjectData layout." — [GitHub: jonkubis/LogicProFormatWriter](https://github.com/jonkubis/LogicProFormatWriter)
- From its PROJECTDATA_FORMAT.md — [raw file](https://raw.githubusercontent.com/jonkubis/LogicProFormatWriter/main/PROJECTDATA_FORMAT.md):
  - **Where the tempo map lives:** an EventSeq record `qSvE` whose payload starts with `60 00 00 00`. Tags are reversed FourCCs; `gnoS` is the Song root. The initial tempo is also copied at `gnoS` payload offsets 0xAA, 0x102 and 0x3BE.
  - **Resolution:** "960 PPQ. 1 bar of 4/4 = 3840 ticks."
  - **Tempo value:** uint32 = round(BPM×10000), so 120 BPM = `80 4F 12 00`. "No float anywhere."
  - **Tempo event layout (32 bytes):**
    - `+0x04`: uint64 position = 38400 + tick@960
    - `+0x0C`: flag (0x00 initial, 0x01 explicit point, |0x80 selected)
    - `+0x10`: tempo
    - `+0x18`: uint32 absolute-time cache, altpos = 7,200,000 + round(Σ(Δtick/960)·(60/bpm)·2000), i.e. 0.5 ms units
    - The payload is 32N + 16 bytes.
  - **Meter:** a separate `qSvE`, 80-byte header plus 48-byte records. Signature bytes are `[denominator exponent][numerator]` (`02 04` = 4/4).
  - **Origins:** tempo and marker positions start at 38400; region positions at 34560.
  - **Version:** the intro says fixtures came from Logic Pro 11.2.2, but the fixture map says 12.0.1. The doc does not reconcile the two.
- geoffmyers/logicx-analyzer: Python scripts for hex dumps and string and chunk extraction from ProjectData (tracks, regions, audio files). Tempo coverage was not confirmed. — [logicx-analyzer (proxied GitHub link)](https://proxy-dev.blitzz.co/proxy/123456/github.com/geoffmyers/logicx-analyzer)
- The Rust crate `bravoh-daw` claims to parse .logicx bundles and ProjectData. Tempo handling was not confirmed. — [docs.rs: bravoh-daw 0.1.0](https://docs.rs/crate/bravoh-daw/0.1.0)
- orchetect/swift-daw-file-tools is a Swift DAW file tool set (search hit; Logic-tempo support not verified). — [GitHub: swift-daw-file-tools](https://github.com/orchetect/swift-daw-file-tools)
- A forum opinion questions whether reverse-engineering Logic formats is allowed under Apple's EULA. Not verified. — [Logic Users Group](https://logic-users-group.com/threads/logic-and-lso-file-format-specs-available.2874/)

### Inferences
- A tempo reader could scan ProjectData for `qSvE` records whose payload starts with `60 00 00 00`, read N 32-byte events, and derive tick = pos − 38400 and BPM = val/10000. Positions are known only to 1/960 beat. The `altpos` field directly gives absolute time in 0.5 ms units from an offset of 7,200,000, i.e. 3600 s. That offset may be tied to the project start or SMPTE (unverified), so it could serve as a cross-check on seconds.
- If Smart Tempo writes per-beat tempo events (Beats resolution), ProjectData parsing gives detected beat positions without going through any GUI export. Beyond the "Save" in Logic, this is the only batch-friendly path.
- Risk: the layout is undocumented and version-specific (11.2.2 / 12.0.1). Re-verify on whatever Logic version is used.

### Gaps
- Whether LogicProFormatWriter ships a *reader* for tempo maps from existing sessions (the README emphasizes writing) was not confirmed.
- Whether Smart Tempo Editor beat markers (as opposed to Tempo track events) are stored in ProjectData or only in audio-file metadata: no source found.

## 4. Smart Tempo Editor beat markers vs. tempo map vs. Flex markers: what survives export?

### Takeaway
Smart Tempo beat markers are analysis data attached to the audio file, or to the MIDI region for MIDI. The project tempo map is a separate list of tempo events in the global Tempo track. Exports (SMF, ProjectData tempo `qSvE`) carry only the tempo map. Beat markers survive only as far as they were transferred into the Tempo track by Adapt or Apply, at the chosen resolution.

### Cited Findings
- "Smart Tempo analysis places beat markers based on the musical tempo detection of an audio file." This is distinct from transients, which "can be edited destructively in the Audio File Editor." Beat markers are edited in the Smart Tempo Editor. — [Logic 10.4 guide: Smart Tempo overview](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)
- Tempo events reach the project via Adapt mode, Apply Region Tempo to Project Tempo, or the Flex & Follow "Align Bars" and "Align Bars and Beats" options. — [Logic 10.4 guide: Smart Tempo project settings](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp6ad7156e.html); [Smart Tempo overview](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)
- 10.4.2 fixes: "'Adapt Project Tempo to Region Tempo' command now reliably places tempo events on bars and beats". Also, "The 'Remove Original Recording Tempo from Audio File' command now properly removes Flex markers". — [KVR: Logic 10.4.2 release notes](https://www.kvraudio.com/news/apple-releases-logic-v10-4-2-42678)
- "Trim start of new regions" sets the region start to the file's first detected downbeat. — [Logic 10.4 guide: Smart Tempo project settings](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp6ad7156e.html)
- The Smart Tempo Editor has x2 and /2 buttons to fix octave errors in the detected tempo. — [Apple Support 102165](https://support.apple.com/en-au/102165)

### Inferences
- Detected downbeats map to bar lines of the tempo map (bar 1 = first downbeat when aligned or trimmed). The meter comes from the Signature track (default 4/4 unless edited). Downbeat evaluation therefore needs the time-signature events too.
- Flex markers are time-stretch anchors, not tempo export data. Ignore them for this purpose.

### Gaps
- No source states whether Smart Tempo detects time signature or meter changes automatically, or only beats and downbeats under the project signature.

## 5. Converting an exported tempo map plus start offset to beat times in seconds

### Takeaway
Integrate piecewise-constant tempo segments: t(tick) = t0 + Σ Δtick/PPQ · 60/BPM_segment. Beats are at multiples of PPQ (adjusted for the signature denominator), and downbeats at bar boundaries from the signature map. The main pitfalls are:
- the offset between the audio file start and bar 1 (region position, SMPTE start of bar 1)
- Smoothed vs. Beats resolution
- Logic tempo curves, which an SMF can only approximate with steps
- making sure the SMF's tempo track and the exported region start are measured from the same origin

### Cited Findings
- mido provides `MidiFile.ticks_per_beat`, `set_tempo` meta messages in µs/quarter, and `mido.tick2second(tick, ticks_per_beat, tempo)`. — [mido docs: MIDI files](https://mido.readthedocs.io/en/latest/files/midi.html)
- pretty_midi `PrettyMIDI.get_beats()` and `get_downbeats()` return beat and downbeat times in seconds from the tempo and time-signature changes. — [pretty_midi docs](https://craffel.github.io/pretty-midi/)
- Logic's bar 1 SMPTE position can be shifted, which made tempo-map imports in Pro Tools land at the wrong timecode. — [Logic Users Group: SMPTE sync issue](https://logic-users-group.com/threads/smpte-sync-issue-when-exporting-midi-from-logic-to-pro-tools.10531/)
- An SMF *import* into Logic ignores tempo and signatures (you must *open* it). A naive round-trip check therefore needs File > Open. — [Logic 9.1.6 manual ch.32 §4](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_32_section_4.html)
- ProjectData tempo positions sit at an origin of 38400 ticks; regions at 34560. — [LogicProFormatWriter PROJECTDATA_FORMAT.md](https://raw.githubusercontent.com/jonkubis/LogicProFormatWriter/main/PROJECTDATA_FORMAT.md)
- The Ableton fallback when no tempo-map export exists: render a click (one note per beat) to audio and re-detect. — [Ableton Help: Extracting a Tempo Map from Live](https://help.ableton.com/hc/en-us/articles/360000046760)

### Inferences
Recipe:
1. Import the song with Smart Tempo in Adapt mode, Flex & Follow set to "On + Align Bars and Beats", Export Tempo Resolution set to Beats.
2. Place the audio region at bar 1, or record the region start in ticks.
3. Export a whole-song MIDI region with File > Export > Selection as MIDI File.
4. In Python: `pm = pretty_midi.PrettyMIDI(path)`, then `beats = pm.get_beats()` and `downbeats = pm.get_downbeats()`.
5. Subtract the audio region's start time in seconds (computed through the same tempo map) to get times relative to the audio file.

Pitfalls:
- **SMF time 0 vs. audio start.** SMF time 0 is the start of the export, which may be the selection start rather than bar 1. Verify with a known click.
- **Resolution.** Smoothed resolution gives averaged tempos, so beat times drift within segments. Use Beats.
- **Tempo curves.** These are stepped in an SMF, so expect small errors.
- **Denominator.** pretty_midi's beat unit follows the signature denominator (e.g. 6/8 gives eighth-note "beats"), so it may not match ground-truth conventions.
- **Octave errors.** The x2 and /2 metrical-level choice in Smart Tempo directly affects the evaluation (compare with CMLt/AMLt).

Cheap sanity check: render a click track in Logic (or use the ProjectData `altpos` cache) and compare against the computed beat times.

### Gaps
- No primary source on the PPQ used in Logic's SMF header (internally 960 per §3), or on whether an exported SMF starts at bar 1 or at the selection start.
- No published accuracy figures for Smart Tempo beat positions against ground truth.
