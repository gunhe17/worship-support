# Apple's tempo/beat-detection engine outside Logic Pro: access routes, licensing, accuracy evidence

Note on method: Web sources are cited inline. Some findings come from **read-only inspection of the binaries on this machine** (macOS 26.6 build 25G72, Logic Pro 12.2 at `/Applications/Logic Pro.app`), using `nm`, `strings`, `otool` and `auval -a`. Nothing was executed or loaded. These are marked "[local inspection]" and have no URL, because the source is the installed binary. They can be reproduced with the commands named.

## 1. Do other Apple apps expose the same engine, and can any be scripted?

### Takeaway
Final Cut Pro 12 (Jan 2026) has "Beat Detection", and Apple says it is built on the new public **Music Understanding** framework (WWDC26). Apple's sources do not say whether this is the same engine as Logic's Smart Tempo. Smart Tempo descends from the iOS Music Memos app. Logic for iPad also has Smart Tempo and BPM Counter. None of these apps has a documented batch or scripting interface for tempo analysis.

### Cited Findings
- Apple confirmed to CDM that Logic 10.4's Smart Tempo is "the same automatic detection we first saw in their Music Memos app for iOS" — [CDM, Jan 2018](https://cdm.link/2018/01/logic-pro-x-10-4-new-effects-and-play-and-mix-audio-without-a-click/)
- Logic 10.4.2 extended Smart Tempo to analyse multitrack recordings and MIDI performances recorded without a click — [Sound On Sound news](https://www.soundonsound.com/news/logic-pro-104-adds-smart-tempo-new-reverb-and-more) (as summarised in search results; the 10.4.2 detail came from SOS news coverage)
- Logic Pro for iPad has a BPM Counter, and its Smart Tempo UI has a "Confidence display: Shows a percentage value that indicates the accuracy of tempo analysis" — [Logic Pro for iPad guide](https://support.apple.com/guide/logicpro-ipad/lpip71b5d15f/3.0/ipados/26)
- Final Cut Pro 12.0 (released 28 Jan 2026) added Beat Detection, which "analyzes a song to reveal its bars and beats". It is switched on with a checkbox in the Audio inspector, and Apple recommends 4/4 material for the most accurate grid — [FCP release notes](https://support.apple.com/102825); [Edit to the beat in FCP](https://support.apple.com/guide/final-cut-pro/ver65b55a2b7/mac); [Newsshooter](https://www.newsshooter.com/2026/01/28/final-cut-pro-12-0/)
- Larry Jordan's review reports that FCP 12 Beat Detection analyses a 3-minute clip in under 5 seconds on a mid-range M-series Mac and shows major and minor beats — [Larry Jordan](https://larryjordan.com/articles/the-new-beat-detection-in-final-cut-pro-12-is-simple-and-effective/)
- WWDC26 session 253 states that "Final Cut Pro analyzes a song for its rhythm and structure to reveal its beat grid" using the Music Understanding framework. Montage on iPad uses it too. The session does not mention Logic Pro — [WWDC26 session 253](https://developer.apple.com/videos/play/wwdc2026/253)
- GarageBand for Mac's docs only describe "Follow Tempo & Pitch" and Flex/quantize for imported audio. I found no documented Smart-Tempo-style analysis in GarageBand — [GarageBand guide](https://support.apple.com/en-gb/guide/garageband/gbnd221a8f4a/mac)
- Apple Music's DJ integrations (March 2025) cover rekordbox, Serato, Engine DJ and djay. BPM and grid analysis of streamed tracks is done by the DJ platform: AlphaTheta hardware "automatic BPM and grid analysis". Apple supplying the BPM is not mentioned — [DJ Mag](https://djmag.com/tech/you-can-now-dj-apple-music-using-rekordbox-serato-and-more); [Mixmag](https://mixmag.net/read/rekordbox-adds-apple-music-support-alphatheta-update-software-dj-tech)
- [local inspection] Logic 12.2 ships no AppleScript or Shortcuts surface for Smart Tempo (none documented). The only engine-bearing component is the private framework `Contents/Frameworks/MAMusicAnalysis.framework` (see Q3).

### Inferences
- In practice, the only ways to drive Smart Tempo without the Logic GUI are UI automation (Accessibility/AppleScript GUI scripting, which is fragile) or the private framework. For a FCP-quality beat grid, the public Music Understanding API is the sanctioned route.
- It is plausible that FCP's Beat Detection and Logic's newer "DownBeatTrackerTCNHMM" (Q3) share model lineage. No source confirms this.

### Gaps
- I found no source on whether MainStage contains the analysis engine. It is not installed here, so I could not inspect it.
- I could not determine whether GarageBand (Mac or iOS) bundles `MAMusicAnalysis`, because it is not installed here.
- Whether FCP 12 and Logic 12 use identical models is unknown.

## 2. Public APIs (AVFoundation, AudioToolbox, SoundAnalysis, ShazamKit, MusicKit, WWDC24–26)

### Takeaway
Until WWDC26 there was **no** public Apple API for tempo or beat detection. **WWDC26 introduced `MusicUnderstanding`**, which returns beat timestamps, bar timestamps and a single global `beatsPerMinute`, along with key, structure, pace, instruments and loudness, on-device, from an `AVAsset` or streamed buffers. It is **not present on macOS 26.6** [local inspection], so it presumably needs the 2026 OS releases (exact versions unverified). MusicKit and the Apple Music API do not expose song BPM.

### Cited Findings
- Music Understanding API: `MusicUnderstandingSession(asset:)` or `(audioProvider:)`, then `analyze()` or `analyze(for:)`. `RhythmResult` has `beats: [CMTime]`, `bars: [CMTime]` and `beatsPerMinute: Float?`. BPM is nil "if the framework hasn't processed enough audio to find at least two beats". Results are `Codable` (JSON export). Apple advises setting `AVURLAssetPreferPreciseDurationAndTimingKey` "to ensure the most accurate results". It runs entirely on-device and offline — [WWDC26 session 253](https://developer.apple.com/videos/play/wwdc2026/253); secondary summary: [Blake Crosley](https://blakecrosley.com/de/blog/music-understanding-framework-ios-27)
- The session gives no separate downbeat-confidence, time-signature or tempo-curve output (bars serve as downbeats), and makes no quantitative accuracy claims — [WWDC26 session 253](https://developer.apple.com/videos/play/wwdc2026/253)
- Docs page: [developer.apple.com/documentation/musicunderstanding](https://developer.apple.com/documentation/musicunderstanding). The availability block did not render through the fetch tool.
- [local inspection] `/System/Library/Frameworks/MusicUnderstanding.framework` does not exist on macOS 26.6 (25G72). The private frameworks with music-related names are `FlexMusicKit` and the MusicKit internals; none is named for tempo or beat.
- Apple Music API / MusicKit: developers report that the Song object has no BPM or tempo attribute. An older reply says MusicKit cannot "access tempo information about songs". A late-2025 post says tempo change and beat-matching appear limited to approved partners — [Dev Forums 726626](https://developer.apple.com/forums/thread/726626); [Dev Forums 90521](https://developer.apple.com/forums/thread/90521)
- [local inspection] `auval -a` lists Apple system AUs (AUTimePitch, AUNewTimePitch, AUSoundIsolation and others). None is a tempo or beat analyser.

### Inferences
- AVFoundation, AudioToolbox, SoundAnalysis (classification only) and ShazamKit (matching only) have no tempo or beat output. I found no evidence to the contrary.
- For research batch use, Music Understanding is the cleanest Apple route. Write a small Swift CLI that loops over files and dumps `RhythmResult` JSON. It gives one global BPM plus beats and bars; a local tempo curve has to be derived from the beat intervals.

### Gaps
- The exact minimum OS versions for MusicUnderstanding (presumably macOS 27 / iOS 27) are not confirmed in a fetched primary source, and neither is whether those OS versions are publicly released as of Oct 2026.
- No published evaluation of MusicUnderstanding accuracy exists yet.

## 3. Private frameworks inside Logic.app: what the engine is and whether anyone calls it

### Takeaway
[local inspection] Logic's tempo engine sits in `MAMusicAnalysis.framework` (internal codename "Metro"), version 6644, universal x86_64/arm64. It exports C++ (not Objective-C) entry points. The beat tracker is a madmom-style pipeline: neural beat and downbeat activations (TCN, run in Core ML) followed by HMM decoding. The binary also contains beat-evaluation metric classes (F-measure, Cemgil). I found no public GitHub project that calls it.

### Cited Findings (all [local inspection] of Logic Pro 12.2)
- Framework list includes `MAMusicAnalysis`, `MAMachineLearning`, `MADSP`, `MAToolKit`, `MAHarmony` and others (`ls "/Applications/Logic Pro.app/Contents/Frameworks"`).
- `MAMusicAnalysis` links CoreML, Accelerate, AudioToolbox, MADSP, MAMachineLearning and MAHarmony (`otool -L`).
- Exported C++ symbols (`nm -gU | c++filt`) include `CreateAnalyzer(MetroTestStrategyIDAudio)`, `CreateMidiAnalyzer(MetroTestStrategyIDMidi)`, `AnalyzeTransients(float const*, long, long, double)`, `AnalyzeTransients(char const*)`, `DetectBeatsFromTransients(...)`, `AnalyzeBeatsFromOnsets(...)`, `ReanalyzeSectionInResult(...)`, `IsHalfTempo`/`IsDoubleTempo`, `ConvertResultToHalfTempo`/`DoubleTempo`, `SnapBeatsToOnsets`, `ShiftBeatsToMatchHints`, `TapTempoInfoSequences`, `QPMTempoListFromBeats` and `RawTempoListFromBeats`. The core types are `CMetroResult`, `MetroBeat`, `MetroTempoNode` and `CMetroAnalyzerHints`.
- Model and algorithm strings: `DownBeatTrackerTCNHMM`, `.beat_activations`, `.downbeat_activations`, `.beat_no_downbeat_activations`, `/DownBeatHMM/downbeathmm.mlbf`, `/DownBeatHMM/jointtimesighmm.mlbf`, `CMetroBeatHMM_Stream`, `CMetroBeatTrackerHMMBacktracker`, `CMetroHMMBeatDetector`, `CBeatHMMPriorMultiPatterns`, `BeatHMMParamStateMappingMinTempo/MaxTempo/NumTempo`, and "Beat Tracker NN Inference Duration: %lld [ms]".
- Core ML model: `MAMachineLearning.framework/Versions/A/Resources/DownbeatTrackerCondMPS.mlmodelc`.
- Internal evaluation classes: `CCompareBeatsFMeasure`, `CCompareBeatsCemgil`, `CCompareBeatDistance`, `CCompareTempoCurve`. These suggest that Apple scores the tracker with standard MIR beat metrics (Davies et al. style).
- `codesign -dv` on the Logic main binary shows `flags=0x0(none)`, i.e. no hardened-runtime flag. This only describes Logic's own signing. A third-party host that loads the framework needs to be unhardened or to hold the disable-library-validation entitlement.
- A web search for `MAMusicAnalysis`, `CMetroResult` or `MAToolKit` on GitHub and the web returned nothing relevant — [search attempt, no results] (no URL; negative result).

### Inferences
- Technically, a C++ harness could `dlopen` the framework with `@rpath` pointed at Logic's `Frameworks` directory, then call `CreateAnalyzer` and run analysis. In practice this means reconstructing undocumented C++ class layouts and ABI (`CMetroResult`, `MetroAnalysisDataSource`, `CMetroAnalyzerHints`), which is reverse engineering. That is expressly prohibited by the SLA (Q5) and breaks with every Logic update. **Not attempted here** (and per project rules nothing was run locally).
- The architecture (TCN activations + DBN/HMM for beats, downbeats and joint time signature) is conceptually the same family as madmom / Böck et al. and Beat This!-era trackers. Expect the familiar octave (x2 or /2) errors, which Apple's own UI exposes.

### Gaps
- I found no class-dump write-ups or GitHub projects that call Logic's analysis frameworks.
- The internal model size, training data, and whether `DownBeatTrackerTCNHMM` is the default strategy for audio in 12.x are unknown.

## 4. Can the BPM Counter AU load in a third-party host?

### Takeaway
No. BPM Counter is a Logic-internal plug-in, not a system Audio Unit. [local inspection] `auval -a` on this Mac, with Logic 12.2 installed, lists no BPM Counter, and no Logic Pro DSP plug-ins appear among system AUs. AU Lab, pedalboard and JUCE hosts cannot load it.

### Cited Findings
- BPM Counter is inserted in Logic from the channel strip menu Metering > BPM Counter. It analyses transients ("impulses") and measures tempo in the range 80–160 BPM — [Logic Pro guide: BPM Counter](https://support.apple.com/guide/logicpro/bpm-counter-lgcef24f3fd9/mac); range per [Logic 9 manual](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_10_section_13.html) (as summarised by search; full page text did not render via fetch)
- [local inspection] The Apple AUs registered with the system (`auval -a | grep appl`) are only the macOS-supplied ones (AUBandpass … AUSoundIsolation, AUTimePitch and so on). `/Library/Audio/Plug-Ins/Components` contains Apple ASAF/ACE components but no BPM Counter.
- Apple's docs describe Logic's built-in plug-ins as part of the app, separate from third-party Audio Units that Logic validates with auval — [Apple: Remove or disable AU plug-ins](https://support.apple.com/en-us/HT201199)

### Inferences
- The BPM Counter's 80–160 BPM limit and real-time transient approach suggest it is a simpler, separate algorithm from Smart Tempo's offline NN+HMM analysis. Even if it could be hosted, it would not be a proxy for Smart Tempo.

### Gaps
- I found no Apple statement that explicitly says "Logic plug-ins are not available to other hosts". The conclusion rests on the auval registry check and the absence of any component bundle.

## 5. Licensing constraints

### Takeaway
The Logic Pro SLA prohibits decompiling, reverse engineering and disassembly, and creating derivative works "of the Apple Software … or any part thereof". Calling private frameworks therefore falls outside the license. Ordinary use of the app, including analysing your own or authorised audio and using the results, is within the license. Commercial and educational entities get one copy per individual/Mac. The only SLA text I could retrieve is version EA1004 (2013, "Logic Pro X"). Whether the current Logic Pro / Creator Studio terms differ was not verified.

### Cited Findings (from [Logic Pro SLA PDF](https://www.apple.com/legal/sla/docs/LogicPro.pdf), version marker "EA1004, 5/31/2013")
- Important note: the software is "licensed to you only for reproduction, modification, publication and distribution of non-copyrighted materials, materials in which you own the copyright, or materials you are authorized or legally permitted to reproduce, modify, publish or distribute."
- §2A(i): the license is to "download, install, use and run for personal, non-commercial use, one (1) copy … on each Apple-branded computer … that you own or control". §2A(ii) covers commercial enterprises and educational institutions: one copy per single individual on their Macs, or multiple individuals on one shared Mac.
- §2E: no use on non-Apple hardware. The software may not be made "available over a network where it could be run or used by multiple computers at the same time".
- §2G No Reverse Engineering: "You may not … decompile, reverse engineer, disassemble, attempt to derive the source code of, decrypt, modify or create derivative works of the Apple Software or any services provided by the Apple Software or any part thereof (except as and only to the extent any foregoing restriction is prohibited by applicable law …)".
- §1A: the "Apple Software" includes "any third party software, content, documentation, interfaces … and any data accompanying this License", which would cover the bundled frameworks and .mlmodelc files.
- The 2013 text has no clause about automation, benchmarking or ML use (grep for "automat|benchmark|machine learning" found only the termination clause).
- Apple Music: the developer forums indicate tempo and beat-matching features are partner-only, not public MusicKit — [Dev Forums 726626](https://developer.apple.com/forums/thread/726626)

### Inferences
- Lowest risk: (a) the public MusicUnderstanding API (governed by the Apple Developer Program License, which permits use of public APIs); (b) driving the Logic GUI on your own licensed Mac and exporting tempo maps (ordinary use). Highest risk: loading `MAMusicAnalysis` directly, because its C++ interfaces have to be reverse engineered (§2G).
- Logic's output (tempo maps, beat markers) is not restricted by the SLA. Reporting accuracy numbers in research is not prohibited by any clause I found.
- Some jurisdictions (e.g. EU Software Directive Art. 6, interoperability decompilation) allow limited reverse engineering despite §2G's carve-out language. This is not legal advice and was not researched in depth.

### Gaps
- The current (Logic Pro 11/12, Apple Creator Studio subscription, Jan 2026) SLA text was not retrieved. The `apple.com/legal/sla/` index did not render its product links.
- I did not retrieve the Apple Developer Program License Agreement terms specific to MusicUnderstanding, or any restriction on training ML models on its output.

## 6. Published accuracy evaluations and algorithm knowledge (patents)

### Takeaway
I found **no published quantitative evaluation** of Logic Smart Tempo, BPM Counter, FCP Beat Detection or MusicUnderstanding against MIR benchmarks or open-source trackers. Reviews are qualitative. Apple's own docs and tutorials acknowledge octave (half/double) errors and wrong-downbeat errors. I found no Apple patent specific to this engine.

### Cited Findings
- Apple's guidance for checking accuracy is to play back with the metronome. If the tempo is off by octave, click x2 or /2. The docs explicitly say Logic may detect "double or half the tempo you want" in Adapt mode. Hints, beat-marker editing and the Smart Tempo Editor are the remedies — [Apple: Match the tempo automatically](https://support.apple.com/kb/HT208458)
- Sound On Sound: "a half-time Trap drum beat at 140bpm may well get detected at 70bpm", and Logic can pick the wrong first downbeat — [SOS Smart Tempo workshop](https://www.soundonsound.com/node/4918970); see also [Logic's Smart Tempo part 1](https://www.soundonsound.com/techniques/logics-smart-tempo-part-1)
- SOS's launch news called it potentially big "if it's as smart as Apple claim", with no test — [SOS news](https://www.soundonsound.com/news/logic-pro-104-adds-smart-tempo-new-reverb-and-more)
- MusicRadar's review praised its flexibility ("elasticness") without measuring accuracy — [MusicRadar](https://www.musicradar.com/news/emagic-logic-platinum-55-review)
- Violet Recording advises checking the tempo track for abrupt jumps where a bar is misread at half or double speed — [Violet Recording](https://violetrecording.com/how-to-use-smart-tempo-in-logic-pro/)
- Ableton Live also needs manual :2/*2 correction. I found no head-to-head Logic vs Ableton vs Melodyne accuracy comparison — [SOS Warping 101](https://www.soundonsound.com/techniques/warping-101-ableton-live?amp)
- FCP 12 Beat Detection is described as "simple and effective", with no numbers — [Larry Jordan](https://larryjordan.com/articles/the-new-beat-detection-in-final-cut-pro-12-is-simple-and-effective/)
- Patent search turned up only non-Apple tempo patents (e.g. US 6,323,412 "real time tempo detection"; US 8,071,869 Gracenote "prominent tempo") — [US6323412](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6323412); [US8071869](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8071869)
- [local inspection] The algorithm family, from binary strings, is a TCN beat/downbeat activation network plus an HMM/DBN with tempo state mapping and a joint time-signature HMM, with onset snapping and hint-based reanalysis (see Q3).

### Inferences
- Any accuracy claim about Apple's engine against Beat This! or madmom would need to be generated by this project. The realistic routes are a Logic GUI export (manual or UI-scripted) or a MusicUnderstanding CLI on a 2026 OS. Under project rules, either would run outside the local machine or as a deliberate manual step.
- Given the shared TCN+HMM design, accuracy is likely to be close to madmom-class trackers, with similar octave failure modes. This is unverified.

### Gaps
- I found no MIR paper, ISMIR late-breaking demo or blog benchmark that measures Smart Tempo or MusicUnderstanding.
- I found no Apple patent tied to Smart Tempo or Music Memos. A Google Patents search by assignee "Apple Inc." with "beat tracking" / "downbeat" was not completed within the tool budget.
