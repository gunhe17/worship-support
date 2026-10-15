# Logic Pro Smart Tempo / BPM Counter 배치 자동화 가능성 (2026-10 기준)

Note: I found no first-party batch or headless API. Every route below is either GUI automation or reverse-engineered file parsing. Logic versions visible in Apple's user guide as of 2026-10: 12.0, 12.2, 12.3 ([Apple Logic Pro User Guide, version selector](https://support.apple.com/en-kz/guide/logicpro/lgcpcca0f60f/mac)).

## 1. How Smart Tempo is triggered, and which settings and versions matter

### Takeaway
Smart Tempo analysis runs when audio is imported or recorded, or on demand per region ("Analyze Tempo" / reanalyze in the Smart Tempo Editor). To get Logic's tempo map for a whole song, you need: Project Tempo mode = **Adapt** (or Auto with no click and no other regions), plus Project Settings > Smart Tempo > "Set imported audio files to" = **On**. Then import one file into an empty project. The detected tempo becomes the project's tempo track.

### Cited Findings
- Apple's steps: File > Project Settings > Smart Tempo, set "Project Tempo mode" to Adapt, and set "Set imported audio files to" to On, which turns Flex on for the imported files. Importing the files then runs the analysis. Results can be refined in the Smart Tempo Editor. The page is dated 2026-06-01, and its images reference 10.7.5 and 11. — [Apple Support 102165](https://support.apple.com/en-au/102165)
- Modes are Keep, Adapt, and Automatic. Automatic switches between Keep and Adapt depending on whether a musical tempo reference (metronome, other regions) exists. A region's Flex & Follow setting decides whether it follows the project tempo. — [Logic 10.4 guide: Smart Tempo overview](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)
- Default behavior for new recordings and imported files is set in the Smart Tempo pane of Project Settings. — [Logic 10.4 guide](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp6ad7156e.html)
- Smart Tempo places beat markers through "musical tempo detection", not transient peaks. If no tempo reference exists, Adapt makes the project tempo follow the audio. If the result comes out at double or half tempo, it can be corrected with x2 or /2. After analysis, Apple recommends switching back to Keep to lock the result. — [Apple Support 102165](https://support.apple.com/en-au/102165), [Apple Artists: Importing stems with Smart Tempo](https://artists.apple.com/support/1465-importing-stems-into-logic-pro-with-smart-tempo)
- The region / Smart Tempo menu includes "Analyze Tempo" (new analysis), "Apply Region Tempo to Project", and "Apply Project Tempo to Region and Downbeat". (Confirmed in the iPad guide; Mac menu names may differ.) — [Logic Pro for iPad guide](https://support.apple.com/guide/logicpro-ipad/lpip99743e51/3.0/ipados/26)
- The Smart Tempo Editor's Edit pop-up includes "adapt the project tempo to the region" and reanalyze. There is a "Show/Hide Smart Tempo Editor" key command. — [Logic 10.4 guide: Smart Tempo Editor](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp2a428fed.html)
- **Caveat:** commercial audio files often carry tempo tags. To force reanalysis you must first remove them with Edit > Tempo > Remove Tempo Information. In the Smart Tempo Editor you can choose Constant or Variable Tempo analysis and set the time signature and downbeat. The Free Tempo Recording setting has options including "Ask" (a dialog). Smart Tempo was introduced in 2018 (10.4). Accuracy is "works really well" for most pop styles, but errors occur in ambiguous cases, and one test misread 6/8 as 3/4. — [Sound On Sound, "Logic Pro: Using Smart Tempo" (Nov 2025)](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo)
- The 12.x guide's table of contents still has the Smart Tempo section ("Protect Smart Tempo edits by locking a range", "Use Smart Tempo with multitrack audio", "Set project tempo with selected audio", etc.). — [Logic Pro 12.x User Guide TOC](https://support.apple.com/en-kz/guide/logicpro/lgcpcca0f60f/mac), [What's new page](https://support.apple.com/guide/logicpro/lgcp4a62a494/mac)

### Inferences
- For several hundred songs, the most stable setup is one **template project** with the settings above (Adapt, imported audio = On, metronome off, empty tracks). Per song: open template → import 1 file → wait for analysis → save or export.
- Per-song correction (x2, /2, downbeat) is manual by design, so a batch run captures Logic's **raw** output. For research, that is arguably the more appropriate thing to measure.
- WAV/AIFF files with embedded tempo info (e.g. ACID/Apple Loop tags) can bypass analysis. Normalizing the input to plain WAV/AIFF avoids this.

### Gaps
- I could not confirm whether 12.x changed the Smart Tempo algorithm or menu names. The What's new page did not render body text through the fetch tool.
- I found no official figure for analysis time per song (3-6 min audio). Apple and SOS give no numbers.
- I could not confirm whether Logic opens a .wav directly as a new project (e.g. `open -a "Logic Pro" song.wav`) and runs Smart Tempo during that.

## 2. Can it be scripted (AppleScript/JXA, UI scripting, Scripter, control surfaces, CLI)?

### Takeaway
**There is effectively no AppleScript or JXA dictionary.** The only realistic automation is (a) Accessibility / UI scripting plus key commands (System Events, Keyboard Maestro, Hammerspoon, atomacos, or a Swift AX tool), or (b) saving with the GUI and then parsing the saved project file directly. Scripter can read only the current tempo at the playback position, and needs real-time playback, so it is impractical for capturing the tempo map. MCU/OSC/Logic Remote can control transport and the mixer, but I found no evidence they expose the tempo map or Smart Tempo commands.

### Cited Findings
- **AppleScript:** in a 2019 Apple Developer Forums thread, a user reported Logic Pro X's dictionary contains only `renderpreview` ("Render an iLife Preview for a project"). Another participant said: "the Pro Apps team has never seen any use in the kind of automation you're talking about... look at the stuff written by indie devs." — [Apple Developer Forums thread 115355](https://developer.apple.com/forums/thread/115355)
- An app that supports only the basic commands (open, print, quit, run, reopen) is not considered scriptable, but those commands still work. — [Apple AppleScript docs: Scriptable Applications](https://developer.apple.com/library/content/documentation/AppleScript/Conceptual/AppleScriptX/Concepts/scriptable_apps.html)
- **Existing GitHub tool (koltyj/logic-pro-mcp, Swift):** it states that "Logic Pro does not expose a programmatic API". It combines five channels:
  - AppleScript: "App lifecycle only (launch, quit, open file)"
  - Accessibility: "State reading, UI button clicks, slider values"
  - CoreMIDI: MMC transport
  - OSC: mixer, requires OSC setup in Logic
  - CGEvent: keyboard shortcuts via postToPid, "no focus needed"

  It has set_tempo and can read transport state, but no tempo analysis or import function. It notes "Some deep state (automation curves, region MIDI data) is not exposed via Accessibility". It needs Accessibility and Automation permissions for the terminal and Logic. — [github.com/koltyj/logic-pro-mcp](https://github.com/koltyj/logic-pro-mcp)
- A separate Node/TS "Logic Pro MCP" project (AppleScript plus key commands plus a Swift AX helper) also exists. It is only a third-party listing and unverified. — [remoteopenclaw listing](https://www.remoteopenclaw.com/mcp/aircrack-ng-debug/Logic-Pro-MCP)
- Python AX libraries: pyUIauto (wraps atomacos) and py2mac. — [pyuiauto on PyPI](https://pypi.org/project/pyuiauto/), [py2mac on piwheels](https://www.piwheels.org/project/py2mac)
- **Scripter (MIDI FX, JavaScript):** setting `var NeedsTimingInfo = true` lets `GetTimingInfo()` return:
  - playing
  - blockStartBeat / blockEndBeat / blockLength
  - **tempo** (float host tempo)
  - meterNumerator / meterDenominator
  - cycling, leftCycleBeat, rightCycleBeat

  The docs show output only through `Trace()` to the console. — [Logic 10.4.5 guide: TimingInfo](https://help.apple.com/logicpro/mac/10.4.5/en.lproj/lgcee186be46.html), [ProcessMIDI](https://help.apple.com/logicpro/mac/10.4.5/en.lproj/lgce225e4d89.html)
- MIDI events have a `beatPos` property, available only with NeedsTimingInfo, which can replace blockStartBeat. — [Logic 11.0 guide (ko): beatPos](https://support.apple.com/ko-kr/guide/logicpro/use-the-midi-event-beatpos-property-lgce8eb55106/11.0/mac/13.5)
- A VI-Control user post (unofficial) says beatPos exists even when the transport is stopped, but has no relation to the actual transport position then. — [VI-Control forum](https://vi-control.net/community/threads/true-legato-script-with-speed-detection.108958/)
- Offline bounce is only for audio and software instrument tracks, not MIDI tracks. Whether Scripter runs during offline bounce is not documented. — [Logic 10.1 guide: Bounce](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcp785a41c3.html)
- **Getting results out, route A: MIDI file export.** Standard MIDI Files can carry tempo changes, and Logic imports and exports format 0 and 1. — [Logic 10.1 guide: MIDI files](https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcpdf6a3851.html)
  - One community tip: show the global tracks, select all, then Export Selection as MIDI File. — [Logic Users Group](https://logic-users-group.com/threads/exporting-tempo-map-time-signatures.991/)
  - Conflicting report: a Logic 8 user said the exported MIDI carried no tempo into Pro Tools (same thread). Another user reports precision drift from ticks / microseconds-per-quarter conversion. — [Steinberg forum](https://forums.steinberg.net/t/logic-and-dorico-workflow/126489?page=2)
- **Getting results out, route B: parse the .logicx file directly.** The `LogicProFormatWriter` project (Python) reverse-engineered `Alternatives/000/ProjectData` (an undocumented little-endian binary). It describes:
  - tempo as `qSvE` (EventSeq) records, 32 bytes per event
  - `+0x04` uint64 position = 38400 + tick@960PPQ
  - `+0x10` uint32 tempo = round(BPM×10000)
  - `+0x18` altpos (absolute-time cache)

  The fixtures say Logic 11.2.2 in one place and 12.0.1 in another, and the document does not reconcile the two. It is a writer, so whether it reads Smart Tempo-generated maps is unconfirmed. — [LogicProFormatWriter README](https://github.com/jonkubis/LogicProFormatWriter), [PROJECTDATA_FORMAT.md](https://github.com/jonkubis/LogicProFormatWriter/blob/main/PROJECTDATA_FORMAT.md)

### Inferences
- **Practical pipeline proposal (expected to be the most reliable):**
  1. Duplicate the template .logicx per song, or open it with `open -a "Logic Pro" template.logicx`.
  2. Import the audio with UI scripting (File > Import > Audio File, type the path with Cmd+Shift+G in the dialog), or drag and drop.
  3. Detect analysis completion by polling the AX tree (the tempo display / LCD value changing, or the progress window disappearing), or simply wait a fixed time.
  4. Save (Cmd+S) or use Export Selection as MIDI File.
  5. Close the project and handle the "Don't Save" dialog.
  6. Offline, parse the tempo events from the MIDI file (mido / pretty_midi) or from ProjectData (the reverse-engineered spec above).

  At most one dialog, file dialog, or modal per step can break the run, so you need timeouts, retries, and a per-song log.
- Route B (ProjectData parsing) needs no MIDI export step, so it has fewer UI steps. It is version-dependent, though. Confirm on the target Logic version first, using a known tempo map (e.g. 120→130 BPM) and checking that the parser reproduces it.
- Route A (MIDI) is Logic's official export format, so it is more robust to version changes. Given the conflicting community reports, verify first that the tempo track is actually included.
- Scripter route: in theory, logging `tempo` and `blockStartBeat` with Trace during real-time playback samples the tempo map. However, it takes real-time playback (3-6 min per song, i.e. tens of hours for hundreds of songs), the Trace console has no documented file export, and the precision is limited to block resolution. **Not recommended.**
- Headless: Logic is a GUI app. It needs a logged-in GUI session plus Accessibility permission, so it cannot run on a server or CI. A dedicated Mac or VM (Apple silicon macOS VM) running unattended overnight is the realistic option. (Inference; no source.)
- This conflicts with the user's memory rule "compute only on Kaggle". Logic is macOS-only, so this route can only run on a local Mac, which is an exception the user must decide on.

### Gaps
- I found no source confirming whether MCU / Control Surface plug-ins / OSC / Logic Remote expose Smart Tempo or tempo-map read/write. koltyj states only "OSC = mixer".
- I could not confirm whether Scripter can write files or send MIDI externally (e.g. to IAC). The docs mention only Trace.
- Default key command assignments for Smart Tempo actions (Analyze Tempo, Apply Region Tempo to Project) are unconfirmed. They are probably unassigned by default and would need to be assigned in the Key Commands window (not confirmed).
- I could not confirm whether Logic's AppleScript dictionary changed in 11.x/12.x. The only source is the 2019 forum thread. Running `sdef "/Applications/Logic Pro.app"` locally would settle it.

## 3. Can the BPM Counter plug-in's reading be captured programmatically?

### Takeaway
BPM Counter is **display-only**. It has no parameters, MIDI output, or automation output, and no way to send its value to the project tempo. It produces one global value (80-160 BPM), not a tempo map, and only works during real-time playback. The only way to capture it would be reading its UI through Accessibility or OCR, so it is unsuitable for a batch pipeline.

### Cited Findings
- BPM Counter detects transients to estimate tempo, works well on drums and bass, and poorly on pads. Range is 80-160 BPM, shown to 0.1 BPM. LED: flashing = measuring, steadily lit = done, flashing during playback = a different tempo was detected. Click the LED to reset. **No adjustable parameters and no output or transfer function are documented.** — [Logic Pro Effects guide 10.1: BPM Counter](https://help.apple.com/logicpro-effects/mac/10.1/en.lproj/lgcef24f3fd9.html), [Logic Pro for iPad: BPM Counter](https://support.apple.com/guide/logicpro-ipad/lpip71b5d15f/3.0/ipados/26)
- In community training material, the workflow is reading the display and setting the project tempo by hand. — [Logic training site: BPM Counter](https://sites.google.com/whosthebass.com/logictraining/effects/dynamic-effects/bpm-counter)

### Inferences
- Many worship songs are below 80 BPM (slow ballads), so they fall outside BPM Counter's 80-160 range. Its value as a research baseline is low.
- If a single global BPM value is needed, the average tempo of the Smart Tempo map, or an external library (librosa/madmom/Beat This!), is far easier.

### Gaps
- I did not check whether BPM Counter's display value appears in the AX tree as a text element. The plug-in UI may be custom-drawn and not exposed to AX.

## 4. Community tools and posts on batch Smart Tempo analysis; time per song, failure modes, headless feasibility

### Takeaway
After searching Apple Community, Gearspace, Reddit, and GitHub, I found **no public tool or post that batch-analyzes multiple songs with Smart Tempo**. The closest building blocks are the Logic MCP servers (AX + key commands) and LogicProFormatWriter (ProjectData spec). A batch pipeline would have to be built in-house.

### Cited Findings
- Apple's official multi-file workflow analyzes stems from **one song** together as a "multiset". It is not batch processing of separate songs. — [Apple Artists: stems + Smart Tempo](https://artists.apple.com/support/1465-importing-stems-into-logic-pro-with-smart-tempo), [Apple Support 102165](https://support.apple.com/en-au/102165)
- Building blocks:
  - The Logic MCP server (AX/CGEvent/CoreMIDI/OSC), with Accessibility permissions required. — [koltyj/logic-pro-mcp](https://github.com/koltyj/logic-pro-mcp)
  - The ProjectData binary spec. — [LogicProFormatWriter](https://github.com/jonkubis/LogicProFormatWriter)
- Dialog / failure-mode clues:
  - The import-tempo prompt for MIDI files, which can be turned off with "Don't ask again" (a notification setting). — [Apple Community](https://discussions-jp-prz.apple.com/thread/251126695)
  - The Free Tempo Recording "Ask" dialog. — [Sound On Sound](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo), [Apple Support 102165](https://support.apple.com/en-au/102165)
  - Embedded tempo tags preventing reanalysis. — [Sound On Sound](https://www.soundonsound.com/techniques/logic-pro-using-smart-tempo)
- Pro-app automation has historically been left to "indie devs". — [Apple Developer Forums 115355](https://developer.apple.com/forums/thread/115355)

### Inferences
- **Expected failure modes:**
  - Modals: the save prompt on project close, import dialogs, sample-rate mismatch notices, and missing-file prompts.
  - The project tempo staying fixed because the mode is Auto instead of Adapt, or because a click or another region exists.
  - x2 or /2 octave errors left uncorrected in the raw output.
  - UI script timing races when the analysis takes long.
  - Logic updates changing the menu or AX structure.
  - The ProjectData format changing.
- **Time per song (estimate, unmeasured):** opening and closing the project, importing, and analyzing a 3-6 min file probably takes tens of seconds to about a minute. Even at 1-2 min per song including safety margins, several hundred songs is roughly 5-15 hours, which is feasible overnight. Measure this first with a 10-song pilot.
- **Headless:** not possible. It needs a GUI login session, Accessibility permission, and a Logic license (Logic 12 also comes via the "Apple Creator Studio" subscription, an item in the guide TOC — [Logic guide](https://support.apple.com/guide/logicpro/lgcp4a62a494/mac)). Run it on a dedicated Mac with screen lock and sleep disabled.

### Gaps
- No measured analysis time or batch success rate exists anywhere. Not found in any source.
- I did not reach individual posts on Gearspace, the Logic Pro Help forum, or Reddit r/Logic_Studio about Smart Tempo batch work. Search showed no evidence one exists.
