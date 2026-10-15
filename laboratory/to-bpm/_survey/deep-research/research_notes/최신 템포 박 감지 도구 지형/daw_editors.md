# DAW, audio editor and video editor tempo/beat detection: batch use and machine-readable export (excluding Logic), as of 2026-10

Scope note: about 20 search/fetch calls. Many vendor manuals were not fetched directly, so several rows depend on forums or trade press. Those are flagged. Logic is covered in `reports/Logic 템포 감지 배치 활용.md` and is not repeated here.

## Q1. Which tools can run beat/tempo detection in batch or headless mode and export beat positions? (the decisive question)

### Takeaway
Only Sonic Annotator (Vamp CLI) is a true headless batch beat tracker with CSV output and a Linux build, so it is the one tool here that fits Kaggle without caveats. REAPER (Linux build, CLI that runs scripts, ReaScript tempo API) is the only DAW with a credible scripted route, but its built-in detection is weak. Every other DAW or video editor needs GUI automation, offers no export of beat positions, or both.

### Cited Findings
**Sonic Visualiser / Sonic Annotator (Vamp hosts)**
- Sonic Annotator is a batch tool that runs Vamp plugins with specified parameters on audio files and writes the features in several formats, including CSV — [vamp-plugins.org forum v1.1 announcement](https://vamp-plugins.org/forum/index.php/topic,260.0.html); [README](https://code.soundsoftware.ac.uk/hg/sonic-annotator/annotate/tip/README.md); [project page](https://vamp-plugins.org/sonic-annotator/)
- The QM Vamp plugin set includes a "beat and barline tracker" (qm-barbeattracker, which gives downbeats/bar positions) plus a tempo estimator and an onset detector — [vamp-plugins.org forum](https://vamp-plugins.org/forum/index.php/topic%2c119.0.html)
- MIREX 2013 beat-tracking submissions were wrappers that called sonic-annotator with a transform file and CSV output, then kept one column. This is a working template for batch evaluation — [MIREX2013 repo changeset](https://code.soundsoftware.ac.uk/hg/mirex2013/rev/bd1482e8c459)
- The newest Sonic Annotator release found is 1.6 (2020). It ships as a 64-bit Linux static AppImage plus a source tarball — [SoundSoftware files](https://code.soundsoftware.ac.uk/projects/sonic-annotator/files)
- Sonic Visualiser (GUI) stable is 5.2 (7 Mar 2025). A 5.2.1 build is listed, and Linux AppImages are offered. The official download page cache still said 4.5.2, so the sources disagree on the current version — [Wikipedia](https://en.wikipedia.org/wiki/Sonic_Visualiser); [sonicvisualiser.org download](https://www.sonicvisualiser.org/download.html); [FileHorse](https://www.filehorse.com/download-sonic-visualiser/download/)

**REAPER 7**
- REAPER's CLI takes scripts as arguments: "Multiple media files and/or scripts may be specified, and will be added or run in order". It also accepts `-nosplash`, and `-nonewinst` runs scripts in an already-running instance. `-noactivate` has been supported on Linux since 7.29, which confirms a Linux build with CLI script execution — [ReaTeam/Doc REAPER-CLI.md](https://github.com/ReaTeam/Doc/blob/master/REAPER-CLI.md)
- ReaScript supports EEL2, Lua and Python. Python must be installed and enabled in preferences — [reaper.fm ReaScript](https://www.reaper.fm/sdk/reascript/reascript.php); API reference (tempo/time-sig marker functions) at [reascripthelp](https://www.reaper.fm/sdk/reascript/reascripthelp.html) (not fetched; function signatures not verified in this pass)
- The built-in route is GUI-oriented: select the item, then "Create measure from time selection (detect tempo)" — [Sound on Sound tutorial (2011)](https://www.soundonsound.com/techniques/tempo-mapping)
- A paid third-party ReaScript claims onset-based tempo detection "more accurate than REAPER's built-in". This is a vendor claim and was not verified — [Gumroad hosiprod](https://hosiprod.gumroad.com/l/tempo)
- A user reports that REAPER plus SWS gives more control over tempo markers but the process is "still tedious" (Jul 2025) — [KVR thread](https://www.kvraudio.com/forum/viewtopic.php?t=610380)
- ReaCoMa 2.0 (FluCoMa CLI tools driven from ReaScript) is an existing pattern of REAPER calling external analysis CLIs — [ReaCoMa wiki](https://github.com/ReaCoMa/ReaCoMa-2.0/wiki/Usage)

**Audacity**
- mod-script-pipe scripting is enabled in Preferences > Modules followed by a restart. Audacity must be running, so it is not headless. Python (PyAudacity) or any language with named pipes can drive the same command set as Macros — [Audacity manual: Scripting](https://Manual.Audacityteam.org/man/scripting.html); [PyAudacity](https://pypi.org/project/PyAudacity); [forum: Macros and Scripting](https://forum.audacityteam.org/t/macros-and-scripting/57320)
- Macros run over a folder of files but have no loops or conditionals. No built-in macro command exported label files at the time of the thread. The workaround is a Nyquist "ExportLabels.ny" plug-in step after a "Label Sounds" step (tested on 3.0.2) — [forum thread](https://forum.audacityteam.org/t/a-humble-question-from-a-total-noob/65748)
- I found no source in this pass describing Beat Finder's algorithm or accuracy. It is a simple Nyquist threshold analyzer that writes labels; this is my knowledge, not verified here.

**Ableton Live 12**
- The Live Object Model `Clip.warp_markers` (get/observe, since Live 11.0) returns a dict of `sample_time` (seconds in the file) / `beat_time` pairs. The last marker is hidden and is used to compute the BPM of the last segment. `add_warp_marker` (allowed segment BPM range [5, 999]), `move_warp_marker` and `remove_warp_marker` exist. So Max for Live or a Remote Script can read auto-warp results as machine-readable beat↔seconds pairs — [Cycling '74 LOM Clip](https://docs.cycling74.com/apiref/lom/clip/)
- The Python Remote Script API is officially undocumented. Community references mirror the LOM — [ableton-lom skill](https://skills.sh/mikecfisher/ableton-lom-skill/ableton-lom)
- The `.als`/`.asd` route: older XML WarpMarker elements carry `SecTime`/`BeatTime` — [Ableton forum](https://forum.ableton.com/viewtopic.php?p=1383377). The AbletonParsing README says Live 12 `.asd` uses a new binary format that it does not support — [DBraun/AbletonParsing](https://github.com/DBraun/AbletonParsing)
- In Live 12.3, imports with warp on place a warp marker at the very start of the file — [Splice support](https://support.splice.com/en/articles/12062819-using-warp-and-timestretch-with-splice-in-ableton-live-12-3)
- I found no Ableton batch or headless tool. "Tempo Follower" follows live input tempo and is not file analysis (from the feature's design; no source fetched).

**DaVinci Resolve 20**
- "AI Detect Music Beats" (Resolve 20) analyzes beat-driven music clips and places beat markers — [Mix](https://www.mixonline.com/technology/news-products/blackmagic-davinci-resolve-20-adds-ai-audio-features); [Larry Jordan](https://larryjordan.com/articles/ai-powered-features-in-davinci-resolve-20/). Version 20.0.1 improved beat-marker detection — [Newsshooter](https://www.newsshooter.com/2025/06/30/davinci-resolve-20-0-1-update/); [No Film School](https://nofilmschool.com/davinci-resolve-20-0-1-update)
- Studio-only status is unresolved. A Reddit user could not find the feature in Free, and Yahoo frames 20.0.1 improvements as "for Studio users" — [Yahoo](https://tech.yahoo.com/apps/articles/davinci-resolve-gets-improved-music-124532395.html); [jayaretv](https://jayaretv.com/edit/davinci-resolve-ai-beat-detector-explained/)
- The external scripting API is Studio-only since 19.1 (Nov 2024) — [Pulse Edit](https://pulseedit.com/davinci-resolve-19-scripting-api-fix.html). The API has `GetMarkers()` — [unofficial API doc (2018)](https://diop.github.io/davinci-resolve-api/); [dvresolve wiki](https://wiki.dvresolve.com/developer-docs/scripting-api). I found no source showing that Detect Music Beats can be triggered from the API, or that its beats appear in `GetMarkers()`
- A Reddit post (anecdotal) says the SureBeat developer stopped the product because of this feature, and that the feature draws on beat_this/madmom research — [Mix/Reddit via search](https://reddit.sudovanilla.org/r/davinciresolve/rising) (secondhand, unverified)
- Resolve runs on Linux (20.x) — [tal.org guide](https://www.tal.org/tutorials/blackmagic-davinci-resolve-linux); [CachyOS forum 20.3.2](https://discuss.cachyos.org/t/davinci-resolve-20-3-2-linux-no-audio-for-normal-user-wireplumber-crashes-on-alsa-access/29677)

### Inferences
- Sonic Annotator plus Vamp plugins (qm-barbeattracker, BeatRoot) is the only option here that meets all of the following: Linux, headless, batch, CSV output, and free/GPL. It can run on Kaggle directly. Its algorithms (QM 2007-era, BeatRoot) are older baselines and will very likely trail Beat This! on the GT set.
- REAPER could be scripted on Linux (CLI script argument, then read tempo markers, then write CSV). REAPER still needs a display or GUI process, so on Kaggle that would need Xvfb. Since built-in detection is the weak part, this mainly adds value as a host for external analyzers, not as a new detector.
- Resolve Studio's Detect Music Beats is the most interesting "new commercial neural beat tracker" (it is said to be beat_this-derived). Even so, it cannot be batched without confirming API access, it needs a paid Studio license plus a GPU, and Kaggle would be impractical.
- Ableton's warp markers are readable via M4L/Remote Script, but they only exist after a GUI import with auto-warp. Batch means GUI automation on Mac/Windows; there is no Linux version.

### Gaps
- Exact ReaScript tempo-marker function signatures were not fetched. I also did not confirm that REAPER's "detect tempo" action can be called by command ID from a script.
- No source confirms whether Detect Music Beats markers are readable through the Resolve API, or whether the feature is in Resolve Free.
- I did not verify a Live 12 `.als` WarpMarker schema (the format changed for `.asd`).

## Q2. Per-tool feature, detection type, export and accuracy (other DAWs, editors, video tools)

### Takeaway
Most DAWs detect a tempo map or bar/beat markers interactively, and the only exchange format is a MIDI file containing the tempo track. No vendor publishes accuracy numbers. User reports rank Logic and Digital Performer above Cubase, Studio One, Ableton, Reaper and FL. Premiere Pro has no native beat detection, and FCP 12 detection has no confirmed export path.

### Cited Findings
**Steinberg Cubase 14 / Nuendo**
- Cubase 14.0.30 release notes (as quoted on Reddit) say Tempo Detection now reliably handles 1–360 BPM. Users still report failures on straight beats — [Reddit r/cubase](https://redlib.ssps.io/r/cubase/comments/1l6i1mo/why_does_tempo_detection_never_work)
- Tempo data reaches a Standard MIDI File only if the tempo track (MasterTrack) is enabled on export — [Sweetwater](https://www.sweetwater.com/sweetcare/articles/midi-tempo-information-not-imported-pro-tools-importing-midi/); [Steinberg forum](https://forums.steinberg.net/t/midi-export-with-no-tempo-data/675008)
- Cubase also has its own `.smt` tempo-track format. A Melodyne MIDI tempo map would not import, but `.smt` would — [Steinberg forum](https://forums.steinberg.net/t/how-to-import-tempo-from-melodyne/130876)
- Old bug: tempo detection worked properly only at 44.1 kHz in Cubase 10 (possibly outdated) — [Steinberg forum](https://forums.steinberg.net/t/bug-tempo-detection-crash-freeze/126791)
- Cubase 13 was reported "accurate" on old recordings (May 2024) — [KVR](https://www.kvraudio.com/forum/viewtopic.php?t=610380)
- No scripting API for analysis was found. Windows/macOS only (no source fetched on OS).

**Studio One 7 (PreSonus/Fender)**
- v7 added "Advanced Tempo Detection" for unevenly timed recordings, which works with the Tempo track. Standard Detect Tempo sits in the Audio Bend submenu, and "Map" indicates multiple tempos — [Sound on Sound](https://www.soundonsound.com/techniques/studio-one-tempo-track)
- Users report missed quiet beats and manual barline marking. It is acceptable but less accurate than Logic — [KVR](https://www.kvraudio.com/forum/viewtopic.php?t=610380)

**Bitwig Studio**
- "Detect Event Tempo" (Tempo menu for audio clips) runs tempo/beat analysis with extra parameters on selected clips. Beat markers can be used for onset slicing — [Bitwig user guide](https://www.bitwig.com/userguide/latest/event_menu_functions/)
- The 5.2 beta fixed tempo-detection issues (raw mode) — [polarity.me](https://polarity.me/posts/polarity-music/2024-05-15-repitch-mode-and-tempo-detection-and-wavetable-fundamental-bitwig-studio-52-beta-2/)
- Bitwig has a Linux build (well known; not re-verified here). It has no headless analysis CLI (none found).

**FL Studio**
- Tempo detection is in the Audio Clip menu in the Playlist and estimates a global BPM — [flstudiopro guide](https://flstudiopro.com/fl-studio-detect-bpm/)
- A user called it poor unless the tempo is embedded in the sample (May 2024) — [KVR](https://www.kvraudio.com/forum/viewtopic.php?t=610380)

**Pro Tools**
- Beat Detective generates Bar|Beat markers from clear-transient audio or MIDI to build tempo maps — [Avid user guide](https://www.avid.com/pro-tools/user-guide/beat-detective); [Sound on Sound](https://www.soundonsound.com/techniques/pro-tools-how-create-tempo-maps)
- Tempo maps leave Pro Tools via MIDI export, which is unavailable in the demo — [Avid DUC](https://duc.avid.com/showthread.php?t=156529); [Avid DUC](https://duc.avid.com/home/forum/pro-tools-software/pro-tools/394876-easiest-way-to-create-tempo-and-meter-map-from-a-click-track)

**Celemony Melodyne 5**
- Melodyne 5 has a "Tempo detection and Auto Stretch" chapter (stand-alone versus plug-in behaviour differs) and saves MIDI from stand-alone — [Melodyne 5 manual PDF](https://images.equipboard.com/uploads/item/manual/112861/celemony-melodyne-5-assistant-manual.pdf)
- A user calls the tempo-extraction workflow fiddly. Stand-alone use may require Melodyne Studio — [KVR](https://www.kvraudio.com/forum/viewtopic.php?t=610380). Cubase did not accept a Melodyne MIDI tempo map — [Steinberg forum](https://forums.steinberg.net/t/how-to-import-tempo-from-melodyne/130876)

**Digital Performer** (not on the list, but users rate it alongside Logic for rubato material) — [KVR](https://www.kvraudio.com/forum/viewtopic.php?t=610380)

**Final Cut Pro 12**
- Clip > Enable Beat Detection (Option+B) draws major and minor beat lines plus song-part markers — [Larry Jordan](https://larryjordan.com/articles/the-new-beat-detection-in-final-cut-pro-12-is-simple-and-effective/)
- No source confirms that beat-grid lines are written into exported FCPXML. Third-party fcp-mcp-server does its own beat detection on the exported XML or media — [PyPI fcp-mcp-server](https://pypi.org/project/fcp-mcp-server/0.15.0/)

**Adobe Premiere Pro**
- It has no native beat detection, and a 2025 Adobe community idea still requests it — [Adobe community idea](https://community.adobe.com/t5/idea-premiere-pro/automatic-beat-detection/idi-p/14635575); [soundxtract guide](https://soundxtract.com/guides/beat-markers-premiere-pro/)
- Third-party plugins: BeatEdit 2 (paid) — [aescripts](https://aescripts.com/beatedit-for-premiere-pro/); BeatMarker (free/OSS) — [GitHub](https://github.com/samaBR85/BeatMarker-PremierePlugin); Beat Marker Pro (local tier) — [Adobe Exchange](https://exchange.adobe.com/apps/cc/205335/beat-marker-pro)

**Cross-tool user consensus**: no DAW handles loose, non-metronomic performance without manual edits. Logic and DP are rated best, and Ableton 12 was judged worse than Logic in one comparison — [KVR thread (2024–2025)](https://www.kvraudio.com/forum/viewtopic.php?t=610380)

### Inferences
- For the worship-support project, DAWs are useful only as comparison baselines, not as GT sources. None publishes accuracy figures, all are GUI-first, and outputs are a tempo map (MIDI SMF) that must be converted to beat seconds.
- Video editors (FCP, Resolve, Premiere plugins) produce timeline markers meant for edit sync. They are lower priority because their export (FCPXML/EDL marker lists) is either unverified or comes from third-party plugins.

### Gaps
- Not researched within budget: iZotope RX, SpectraLayers, Cakewalk/Sonar, CapCut auto beat (search returned nothing), Studio One/Bitwig/FL prices and current version numbers, and Pro Tools 2025 changes.
- There is no quantitative accuracy evidence (F-measure etc.) for any commercial DAW detector in the sources found.

## Q3. Linux / Kaggle compatibility summary

### Takeaway
Of all the tools, only Sonic Annotator is a practical Kaggle candidate. REAPER and Audacity have Linux builds, but they need a GUI process (Xvfb) and their built-in detectors are weak. Resolve has a Linux build, but its beat feature is probably Studio-only and its API path is unverified.

### Cited Findings
- Sonic Annotator 1.6 offers a Linux static AppImage — [SoundSoftware files](https://code.soundsoftware.ac.uk/projects/sonic-annotator/files)
- Sonic Visualiser offers a Linux AppImage — [download page](https://www.sonicvisualiser.org/download.html)
- REAPER CLI options are documented for Linux (7.29+) — [REAPER-CLI.md](https://github.com/ReaTeam/Doc/blob/master/REAPER-CLI.md)
- Audacity scripting needs a running Audacity instance — [Audacity manual](https://Manual.Audacityteam.org/man/scripting.html)
- Resolve 20 runs on Linux — [tal.org](https://www.tal.org/tutorials/blackmagic-davinci-resolve-linux); its scripting is Studio-only — [Pulse Edit](https://pulseedit.com/davinci-resolve-19-scripting-api-fix.html)

### Inferences
- Recommended action: add sonic-annotator with `vamp:qm-vamp-plugins:qm-barbeattracker` and BeatRoot as a cheap classic baseline in a Kaggle notebook (AppImage, CSV output, then mir_eval).

### Gaps
- I did not check whether Sonic Annotator's AppImage runs inside the Kaggle container (FUSE may be unavailable; `--appimage-extract` would be the workaround, untested).
- No Bitwig, Audacity or REAPER Linux download pages were fetched in this pass.
