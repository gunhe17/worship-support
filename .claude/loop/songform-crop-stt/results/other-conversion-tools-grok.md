I'll compare commercial scanners, chord-chart tools, 2025–2026 OMR papers, Korean digitization services, and what people on X actually report—then judge whether any of it beats Audiveris plus a vision model for Korean lead sheets.The first pass turned up Opuscan, Flat’s CJK claim, and a Korean choir-score thread. I’m checking prices, engines, lyrics support, and newer papers before writing the verdict.**Nothing here beats Audiveris for structure plus a vision model for Korean lyrics and chord symbols.** The only products worth a paid page trial are Opuscan (Flat) and Soundslice. Both claim Hangul lyrics and MusicXML. Neither has a published result on a printed CCM lead sheet (staff + chords + Korean lyrics + Verse/Chorus + repeats).

## Comparison

| Tool | Alive? | Export | Korean lyrics | Chords / form | Price | How you use it | Engine |
|---|---|---|---|---|---|---|---|
| **Opuscan / Flat scan** | Yes, 2026 | MusicXML, MIDI | **Claimed** if you set language before convert | Lead sheets; chords as chords; voltas, D.S./D.C., coda | ~$9.99/30 pages, no subscription ([Scoring Notes](https://www.scoringnotes.com/news/flat-sharpens-a-natural-approach-to-platform-agnostic-music-notation-software/), 22 Sep 2026) | Apps **and** `POST /v2/omr/jobs` ([docs](https://flat.io/developers/docs/api/omr/)) | Own model. They say they dropped a third-party engine in Jun 2026 ([Flat](https://blog.flat.io/scan-sheet-music-flat-own-model/)). Not Audiveris |
| **Soundslice** | Yes, scans updated through Sep 2026 | MusicXML, MIDI, GPX on a paid plan | **Korean is in the lyric list** ([5 Feb 2026](https://www.soundslice.com/blog/304/better-lyrics-language-support-in-scans/)) | Fretboard **diagrams** yes (Dec 2025). Text chord symbols and Verse/Chorus-as-form **not confirmed** | Free: 2 tiny scans/mo. Plus $5/mo, 100 pages ([scanner](https://www.soundslice.com/sheet-music-scanner/)) | Web GUI. Slice API exists; scan-by-API **unverified** | Own. Not a known rebrand |
| **PlayScore 2** | Yes (iOS/Windows text; Android still no lyrics) | MusicXML, MIDI | **Not claimed.** Latin-oriented OCR | Repeats, 1st/2nd endings, D.S. when “Lyrics and text” is on; guitar chords on Apple ([spec](https://www.playscore.co/blog/faq-items/specification/)) | Pro about $6.99/mo or $59.99/yr (US store reports; official site is in-app regional) | GUI. **ReadScoreLib** is a paid C SDK, not a public REST API | Organum ReadScoreLib + Dolphin SeeScore. Not Audiveris |
| **ScanScore 3.5** | Yes, Sep 2026 | MusicXML, MIDI | Not claimed | “Lyrics and chords even outside the staff” ([products](https://scan-score.com/en/products/)) | €39/yr (≤4 staves), €79/yr unlimited | Desktop GUI only | Lugert/capella line, not Audiveris/PhotoScore/SmartScore. Parent page not re-opened this pass |
| **SmartScore 64** | Site current Nov 2025 | MusicXML, MIDI | Japanese lyrics rated **no** by a 2025 JP dealer; Korean unclaimed | Songbook: lyrics + chord symbols, max 3 staves | $199 Songbook, $399 Pro ([Musitek](https://www.musitek.com/)). $49 MIDI edition has **no** lyrics | GUI | Musitek. Old Finale PDF import used this, not Audiveris |
| **PhotoScore Ultimate** | Still sold 2025 | MusicXML, MIDI | Same JP table: **no** Japanese lyrics | Lyrics + chord symbols on full edition | ~¥44,990 inc. tax ([dealer](https://h-resolution.com/blog/neuratron-photoscore-notateme-ultimate-music-tech-solutions-1/), Nov 2025) | GUI. Sibelius “Lite” is this engine, cut down | Neuratron |
| **Newzik LiveScores** | Yes | MusicXML, MIDI on Premium | Unverified | General OMR, not lead-sheet-specific | Essentials ~€30 one-time (10 pages); Premium ~€50/yr (secondary writeup, not their pricing page) | GUI/cloud | “Own”; vendor not disclosed |
| **MuseScore** | App has **no** scanner | MusicXML after import | Unknown | n/a | Cloud import was **Audiveris**; 2025 forum posts say it moved to closed “MuseSight” | Website upload, not an API | Was Audiveris. MuseSight = **unverified** support mail |
| **Dorico / StaffPad** | Yes | MusicXML in/out | n/a | n/a | Dorico license / StaffPad purchase | No print OMR. StaffPad reads a **pen**, not a photo | — |
| **PDFtoMusic Pro** | Store updated Jul 2026 | MusicXML, MIDI | Only if the PDF already has text | Vector PDFs from notation software **only** | $199 ([Myriad](https://www.myriad-online.com/en/products/pdftomusicpro.htm)) | GUI | Not OMR. Useless on a phone photo |
| **iReal Pro** | Yes | PDF out, not scan-in | No | You type the chart | App purchase | No image OCR | — |
| **Chordify** | Yes | Chord PDF/MIDI from **audio** | No | Not a sheet scanner | Subscription | Audio/YouTube only | — |
| **ChordScanner** | App Store, Aug 2026, 2 ratings | Chords on screen only | No | Claims 300+ chord types from a photo. No notes, no lyrics | Free + ads | On-device GUI. Accuracy **unverified** | Unknown toy app. No “ChordSharp” equivalent found |
| **ScoreMaker ZERO** (Kawai) | Yes, Japan | Own format + interchange | **Japanese** lyrics, not Korean | Full notation | Windows subscription; ~¥22,880 year 1 (same JP table) | GUI | Kawai. Closest CJK commercial OMR, wrong language |

Sheet Music Scanner (Remusician, ~$20 Android) exports MusicXML. Engine unknown. Do not assume it is PlayScore.

## Papers and new models (2025–2026)

The only lead-sheet paper is [ISMIR 2025 / arXiv:2509.05329](https://arxiv.org/abs/2509.05329): handwritten jazz, melody + chords, **lyrics explicitly left for later**. It fine-tunes Sheet Music Transformer to `**kern` and MusicXML. Code and weights are public. It does not cover printed Hangul.

[LEGATO 2, arXiv:2607.05769](https://arxiv.org/abs/2607.05769) (7 Jul 2026) is a system-by-system vision model that emits titles and annotations with the notes. Not syllable lyrics, not CJK, and code is “on publication,” so it is not a tool. Jeongganbo OMR ([JOCCH, Sep 2025](https://dl.acm.org/doi/10.1145/3715159); TISMIR 2026) is court-music grid notation, not a 5-line staff. Zeus (Sep 2026) finds staves; it does not transcribe. No public successor to oemer/homr/SMT does this page type. ScoreFlip’s “~96% of notes” is marketing, unverified, with no Korean claim.

## Korea, and what X actually says

No Korean church vendor turns a printed lead sheet into MusicXML. [WorshipTools Charts](https://www.worshiptools.com/ko-kr/charts) (Korean UI) imports SongSelect, PraiseCharts, PDF, and ChordPro. digitalScore is a PDF stand. 악보가게 is human engraving. “Church Music & Liturgy Planner” advertises photo→MusicXML with no independent test and no Hangul claim.

On X, the only serious Korean report is [Dylan Ko, 6 Sep 2026](https://x.com/Gonnector/status/2096608499262484700): choir score 가시리. Audiveris dropped measures and broke rhythm. Paid OMR failed split voices. He did **not** ship an OMR engine. A vision model wrote note JSON, then MusicXML, checked against audio. Hangul singing still failed because syllables were not linked. Nobody in worship/CCM posted a successful chord+lyric scan. A Sep 2026 hymn-from-a-hymnal test “failed pretty badly” ([post](https://x.com/EthanReedy6/status/2103914688790900890)); the app is not named.

## Verdict

Stay on Audiveris for key, measures, and repeats, and a vision model for Hangul and chord text. MusicXML from these apps still will not give you a song-form object (Verse/Chorus); those markers are plain text if OCR catches them.

If you spend money on one check, run **one page through the Flat OMR API** with Korean selected. It is the only 2026 system that claims all of: lead sheet, real chord symbols, repeats/D.S., Hangul, and an HTTP API. Treat a pass as unproven until that page comes back. Soundslice is the second check, for lyrics only. Do not expect ScanScore, PlayScore, SmartScore, or PhotoScore to read Hangul.
