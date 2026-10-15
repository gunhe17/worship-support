# Musician-practice apps and worship-team tools: tempo/beat detection vs curated tempo metadata (as of Oct 2026)

Scope note: extends `reports/찬양 BPM 정답 데이터 확보.md`. That report already covers the MultiTracks Click stem as the precise beat GT, the MultiTracks ToS (personal/non-commercial, no scraping), the MultiTracks.co.kr launch (WELOVE, J-US, Levites, Team Luke, Whole Life Worship), PCO BPM/Meter fields, PraiseCharts word labels, GetSongBPM/Tunebat circularity, and Spotify audio-features shutdown. This note does not repeat those, and adds per-tool facts. ~25 tool calls; many listed tools could not be verified (see Gaps).

## Q1. Which tools DETECT tempo/beats from audio, and what can you get out of them?

### Takeaway
Consumer detection apps (Moises, Chordify, ChordU) are closed boxes. They show BPM, beats and sections inside the app, but no source confirms you can export the beat grid or BPM as data. Their audio export is stems and click audio only. They work as an occasional manual cross-check, not as a batch comparison method. Transcribe! is a manual marker tool, not a detector.

### Cited Findings
- **Moises**: according to its store listing, the app detects and displays BPM, and its click track is "in sync to the beat of any song." Export is audio only: mixes and separated stems, including the metronome click track. No source found any BPM, beat or chord data export (MIDI/text) — [App Store](https://apps.apple.com/app/id1515796612); [CO/AI listing](https://about.getcoai.com/tool-detail/moises/136693/)
- Moises Smart Metronome "listens to every beat… detecting every down/offbeat" and estimates BPM. Moises's own help article titled "The BPM is wrong; what should I do?" says the value is not 100% accurate and should be treated as a starting point. The page returned 403 when fetched directly; the content comes from the search snippet — [Moises Help](https://help.moises.ai/hc/en-us/articles/16697903875484-The-BPM-is-wrong-what-should-I-do)
- Moises "Sections" (announced 2023-09-11) auto-detects intro, verse, chorus and bridge and loops "with downbeat precision." It is Premium only and available on web, desktop, iOS and Android. The page does not mention exporting section or beat data — [Moises blog](https://moises.ai/blog/moises-news/new-song-sections-feature/)
- The free tier limits Smart Metronome and Chord Detection to the first minute of a song (aggregator claim) — [CO/AI](https://about.getcoai.com/tool-detail/moises/136693/)
- Pricing, from a competitor blog (unverified): Free, Premium $3.99/mo, Pro $9.99/mo; the review says Pro includes "API access" — [StemSplit review](https://stemsplit.io/blog/moises-ai-review)
- **Music.ai** (Moises's B2B platform) offers API access and a no-code dashboard built from "modules" and "workflows." The npm SDK exposes a `music-ai/generate-chords` workflow (upload → addJob → download results). No beat or tempo workflow name was confirmed — [music.ai docs](https://www.music.ai/docs); [npm @music.ai/sdk](https://www.npmjs.com/package/@music.ai/sdk)
- **Chordify**: extracts chords from YouTube, Deezer, SoundCloud and user files (ISMIR 2015 LBD). Premium adds transpose, capo, slow-down, loop, and chord download as MIDI or PDF. No source shows a BPM readout or beat-grid export, and no public API was found — [ISMIR 2015 LBD](https://www.ismir2015.uma.es/LBD/LBD42.pdf); [guitarchalk review (2018)](https://www.guitarchalk.com/chordify-review/); ToS at [chordify.net T&C](https://chordify.net/pages/terms-and-conditions/) (text not fetched)
- **ChordU** (a separate app) advertises a "Dynamic BPM graph" showing beat variation. It covers Korean CCM. For example, its page for 마커스워십 "찬양하세" lists **142.15 bpm**, which is an algorithmic estimate — [ChordU App Store](https://apps.apple.com/app/id1441939045); [ChordU 찬양하세 page](https://chordu.com/chords-tabs-%EB%A7%88%EC%BB%A4%EC%8A%A4%EC%9B%8C%EC%8B%AD-%EC%B0%AC%EC%96%91%ED%95%98%EC%84%B8-come-let-us-sing-%EB%B2%A0%EC%9D%B4%EC%8A%A4-bass-cover-id_QYjpFLtgb0Y); [ChordU premium](https://chordu.com/gopremium)
- **Transcribe! (Seventh String)**: section, measure and beat markers are placed by the user during playback. I found no evidence of automatic beat detection. v8.73 added an option for "Export Text Blocks" to include markers. A third-party CLI converts `.xsc` project files to JSON or Audacity labels, including timestamps of section, measure and beat markers — [Seventh String history 8.73](https://seventhstring.com/xscribe/history/history873.html); [transcribe-xsc-file-converter](https://github.com/roryokane/Transcribe-xsc-file-converter)
- **click-midi** (GitHub): converts an audio click track into a MIDI file with tempo and time-signature data. It targets DAWs that cannot export tempo maps, such as Ableton. It requires a barline sound at the start of each bar and a consistent subdivision. Its documentation is incomplete — [click-midi](https://gitblind.noratr.app/noahbaxter/click-midi)

### Inferences
- None of the consumer detectors gives batch or exportable beat timestamps. Adding them to the 14-method comparison would mean manually reading BPM per song from a UI, and their ToS (not fetched) almost certainly bar automation. Their value as (a) a comparison method is therefore low: at most a 10–20-song spot check of "what a worship musician would see." Their value as (b) ground truth is zero, since the output is algorithmic and has the same octave-error risk as the models under test.
- Music.ai is the only detector with an API. If a beat or tempo module exists, it would be the one commercial "industry baseline" that could be added programmatically. This is unconfirmed.
- Transcribe! plus the xsc converter is a cheap manual-annotation tool for tier B. It sits on the same footing as Sonic Visualiser and TimeCues from the earlier report: human-made, exportable to JSON.
- click-midi is directly useful for tier A: it turns a MultiTracks Click stem into a tempo map with time signatures. It is an alternative to writing our own onset-detection code, but its strict barline requirement may not match MultiTracks clicks.

### Gaps
- Not verified (no searches spent or no results): Anytune, Capo (SuperMegaUltraGroovy), Amazing Slow Downer, BandLab SongStarter/tempo detect, Soundtrap, Yousician, Ultimate Guitar, Songsterr, Riffstation status, Soundbrenner, liveBPM, and the accuracy of mobile BPM apps. No published accuracy figures were found for any consumer app, including Moises.
- Music.ai beat/tempo module names, output format and API pricing are unknown.
- Chordify, Moises and Music.ai ToS clauses on automated use were not fetched.

## Q2. Which worship tools PROVIDE curated (human-made) tempo metadata or tempo maps, and can it be extracted?

### Takeaway
Curated tempo comes almost entirely from the playback/multitrack ecosystem, as a click audio stem plus a BPM number. Tempo maps exist inside Playback, but no source shows a way to export them. Planning Center is the only aggregator with an official API, and it pulls BPM from Worship Online. PraiseCharts and Loop/Prime give little machine-usable tempo.

### Cited Findings
- **MultiTracks Playback, Cloud Songs**: users enter tempo changes as BPM-at-timecode markers (format mm:ss:ms, for example 0:12:800). Gradual ramps use multiple points. Instant changes use two points 1 ms apart. The starting tempo must be included. The grid, the built-in click, sections and MIDI cues then follow the map. Data is meant to come from a DAW's tempo list. The help article does not say whether catalog songs ship tempo maps, and it does not mention any export. Creating Cloud Songs requires Cloud Pro, the Live Bundle or MultiTracks One — [MultiTracks Help 5250015](https://helpcenter.multitracks.com/en/articles/5250015-how-to-add-tempo-changes-to-a-cloud-song)
- Playback workaround for tempo-change songs without a map: use an uploaded click track. Song Sections then "will not function properly," and looping and section reordering should be avoided — [MultiTracks Help 10269561](https://helpcenter.multitracks.com/en/articles/10269561-cloud-song-tempo-change-click-track-workarounds)
- **MultiTracks.co.kr** claims "20,000곡 이상" (20,000+ songs). On page 1 of 2,402 artist results, the only Korean acts were **위러브 WELOVE (7 albums)** and **기프티드 GIFTED (2 albums)**. 마커스, 어노인팅, 제이어스, 예수전도단, 아이자야씩스티원, 히즈윌, 레위지파, 팀룩 and 홀리라이프 did not appear on that page. Only page 1 was checked — [MultiTracks.co.kr](https://www.multitracks.co.kr/); [artists](https://www.multitracks.co.kr/artists/)
- **Loop Community Prime**: offers song sections, section looping and jumping. Users can add custom section markers only to their own uploaded Prime Cloud tracks. Prime's "dynamic click does not recognize tempo or time signature changes," so for tempo-change songs you turn off Generate Dynamic Click and use the uploaded click — [Loop Community FAQ](https://loopcommunity.com/faq/5/50); [Prime App Store](https://apps.apple.com/app/id664688175)
- **PraiseCharts**: sells Click Track, Rhythm Track and MultiTrack (WAV) products. The click-track page for "The Blessing (Radio)" shows Meter 4/4 and Tempo "Slow" with **no numeric BPM**, MP3 format, at $6.24 — [PraiseCharts click track](https://www.praisecharts.com/songs/details/75037/the-blessing-radio-sheet-music/click-track); [top songs with a click track](https://www.praisecharts.com/song-lists/top-songs-with-a-click-track)
- **Worship Online → Planning Center**: "Add To PCO" imports tutorial links, keys, **BPMs**, song structures and more into Services. Pricing is not stated — [PCO integration page](https://planningcenter.com/integrations/worship-online)
- **CCLI SongSelect → PCO**: imports lyrics and chord charts. It needs a paid SongSelect account and activity every 60 days to stay enabled. No source confirms that SongSelect supplies BPM — [PCO help](https://help.planningcenter.com/en/songselect--by-ccli-integration.html); [PCO integrations](https://www.planningcenter.com/integrations/songselect)
- **Planning Center API**: official APIs exist for Calendar, Check-Ins, Giving, Groups, People and **Services** — [PCO help: API](https://help.planningcenter.com/en/144877-the-planning-center-api.html). A third-party MCP server reports "Tempo (BPM)" across recent services — [planning-center-mcp](https://glama.ai/mcp/servers/nathanrcast/planning-center-mcp). The developer docs page is JS-rendered and could not be fetched, so the arrangement field names (`bpm`, `meter`) are unconfirmed — [developer.planning.center](https://developer.planning.center/docs/#/apps/services/2018-11-01/vertices/arrangement)
- **OnSong** (chart app): stores a Tempo (BPM) field and the CCLI number per song, and prints a Tempo column in song lists — [OnSong manual: metadata](https://www.onsongapp.com/docs/console/palettes/metadata/); [song list extras](https://onsongapp.com/docs/song-list-extras)

### Inferences
- For (b) ground truth, the ranking from the earlier report holds. Only MultiTracks gives a time-resolved, human-made tempo truth, and only as **audio** (the Click stem), not as an exportable map. Turning that audio into a tempo map (our own onset detection, or click-midi) is unavoidable.
- PCO is the only route to batch global BPM, through Worship Online or manual entry, with API access limited to one's own church account. It gives a global BPM label (tier C), never beats. Values are user-editable, so treat them as noisy.
- PraiseCharts word labels ("Slow") are useful only as an octave sanity check (slow vs. fast), not as BPM.
- Prime's dynamic click ignores tempo changes, so Prime metadata cannot flag tempo-change songs. MultiTracks's "tempo variations" note (earlier report) remains the only catalog-level tempo-change flag found.

### Gaps
- Whether MultiTracks catalog songs carry tempo maps visible in Playback, and whether any export path (MIDI or ALS) exists for them, is unconfirmed.
- Not verified: WorshipTools, Worship Initiative, Worship Online's own BPM source and price, and whether SongSelect shows BPM.
- Whether MultiTracks.co.kr has 마커스, 어노인팅 or 제이어스 beyond page 1 is unknown. A site search per artist would settle it.

## Q3. Korean worship (CCM/찬양) coverage: where do BPM numbers appear, and how trustworthy are they?

### Takeaway
I found no Korean service that provides official or curated BPM for 찬양 at scale. BPM numbers do appear on user-made sheet music on marketplaces (마피아니스트, CopyDrum), as single arranger-chosen values, and as algorithmic estimates on ChordU. Official 마커스/어노인팅 tempo metadata was not found.

### Cited Findings
- **마피아니스트**: the 마커스워십 "감사함으로" piano 3-stave sheet by user arranger Samuel Park lists "4/4 박자, 115 bpm." It costs 3,400원 and can be used for 30 days after purchase. The site carries a KOMCA badge and a takedown-request page — [mapianist 66715](https://www.mapianist.com/sheet/66715). The marketplace sells many 마커스 parts (piano, bass, lead sheet) — [mapianist 95726](https://www.mapianist.com/sheet/95726); [106604](https://www.mapianist.com/sheet/106604)
- **CopyDrum**: the drum sheet for 마커스워십 "좋으신 하나님" is marked 131 BPM (from the search snippet) — [CopyDrum](https://www.copydrum.com/ko/drum-sheet/%EC%A2%8B%EC%9C%BC%EC%8B%A0-%ED%95%98%EB%82%98%EB%8B%98-%EB%A7%88%EC%BB%A4%EC%8A%A4%EC%9B%8C%EC%8B%AD-markers-worship-eb4c)
- Other Korean sheet sellers carrying 마커스 and 어노인팅: 사운드리더 — [soundleader](https://www.soundleader.co.kr/links/?c=M102295); 주님의교회몰(jh1004) — [jh1004](https://www.jh1004.com/malls.go?pCode=50505000110). Whether they show BPM was not checked.
- A 2012-era blog advises downloading 마커스 and 어노인팅 sheets from the teams' official SNS or homepages rather than third-party redistributions — [dalchun](https://dalchun.com/entry/%EB%A7%88%EC%BB%A4%EC%8A%A4-%EC%96%B4%EB%85%B8%EC%9D%B8%ED%8C%85-%EC%95%85%EB%B3%B4)
- Korean-language searches for "찬양 MR 클릭 BPM 판매" and "멀티트랙 마커스 어노인팅 BPM" returned no relevant pages (search-engine coverage of Korean is poor) — no source.

### Inferences
- Marketplace BPMs are one transcriber's reading of one recording (studio or live) and may refer to a different version than our audio. They are useful for octave and beat-unit adjudication in tier C, and weak as BPM truth: errors of ±5% or more are plausible. Each sheet is per-song paid and time-limited (30 days), and ToS forbids scraping (not fetched), so this does not scale to 500 songs.
- ChordU-style algorithmic BPM on Korean CCM is useful as a free extra comparison point only if read manually. It is circular as ground truth.
- For Korean songs outside MultiTracks.co.kr's catalog (likely most of 마커스 and 어노인팅), tier A precise GT has no commercial shortcut. Tier B, model output plus human correction, is the realistic path.

### Gaps
- Korean MR/AR multitrack sellers with click stems (for example church-band MR shops) were not identified. Better Korean search (Naver) is needed, and this tool's search is US-only.
- Whether official 마커스, 어노인팅 or 제이어스 sheet music includes ♩= markings is unknown.
- No community dataset of worship-song BPMs (Korean or global) was found. PCO data is private per church. SongBPM/GetSongBPM pages for CCM were not checked in this pass (the earlier report flags them as algorithmic anyway).

## Summary table (for the report writer)

| Tool | Detect / Curated | Output visible | Export/API | Korean 찬양 | (a) comparison | (b) GT |
|---|---|---|---|---|---|---|
| Moises | Detect | BPM, click, chords, sections | Audio stems + click audio only; Pro "API" (unverified) | Any uploaded audio | Low (manual) | No |
| Music.ai | Detect (B2B) | Chords confirmed; beat/tempo unconfirmed | API + SDK | Any audio | Possibly medium if a beat module exists | No |
| Chordify | Detect (chords) | Chords | MIDI/PDF chords (Premium); no API found | Any YouTube | Low | No |
| ChordU | Detect | BPM, dynamic BPM graph | None found | Yes (e.g. 마커스) | Low (manual) | No |
| Transcribe! | Manual markers | Section, measure, beat markers | Text export + xsc→JSON converter | n/a | — | Annotation tool (tier B) |
| MultiTracks / Playback | Curated | BPM, meter, Click stem; Cloud tempo maps | Click audio; map export not found | WELOVE, GIFTED (+ earlier list) | — | **Best (tier A)** |
| Loop Prime | Curated audio | Sections, click | None; dynamic click ignores tempo changes | Unknown | — | Weak |
| PraiseCharts | Curated | Meter + word tempo ("Slow") | Click MP3, $6.24 | Unknown | — | Octave check only |
| PCO (+Worship Online) | Curated / user-entered | BPM, meter, structure | Services API (own account) | User-entered | — | Tier C global BPM |
| 마피아니스트 / CopyDrum | Curated (user arrangers) | Single BPM + meter | None; 30-day PDF | Yes | — | Tier C octave/meter check |
