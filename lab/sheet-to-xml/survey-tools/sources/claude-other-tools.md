# Lead-sheet conversion tools — research beyond Audiveris/oemer/homr/SMT/Qwen3-VL/PaddleOCR-VL

> Source: Claude research subagent (web). Preserved as reported.

## Comparison table

| Tool | Maintained 2025-26 | Structured export | Lyrics (Korean?) | Price/License | Automatable? | Notes |
|---|---|---|---|---|---|---|
| **Opuscan** (Flat.io team) | Yes, active | MusicXML, MIDI | Yes — explicit language picker incl. Korean/Japanese/Chinese/Cyrillic; claims syllables stay aligned to verses | $9.99/30 pages, pay-per-page, no subscription | GUI only (Mac/Win/mobile), no public API found | **Best Korean-lyric claim found in this survey** — worth a real test [opuscan.com/omr](https://www.opuscan.com/omr/), [opuscan.com/use-cases/music-ocr](https://www.opuscan.com/use-cases/music-ocr/) |
| **ScanScore** | Yes | MusicXML, MIDI, audio | Yes (lyrics/chords recognized per docs) | $39–179 one-time | GUI only | No CJK claim found [scan-score.com](https://scan-score.com/en/) |
| **SmartScore 64/X2 Pro** (Musitek) | Yes | MusicXML | Lyrics, chord symbols, guitar tab all recognized | Commercial, price not published in results | GUI only | No CJK claim; independent proprietary engine [musitek.com](https://www.musitek.com/smartscore-pro.html) |
| **PhotoScore Ultimate / NotateMe** (Neuratron) | Presumed yes | .xml/.musicxml | Lyrics, chord diagrams, guitar tab | Commercial, "high" per reviews | GUI only | [scoringnotes.com review](https://www.scoringnotes.com/reviews/a-review-of-optical-music-recognition-software/) |
| **PlayScore 2** | Yes | MusicXML | Yes, "text and lyrics exported along with music" | Freemium app | GUI/app only, no API found | [playscore.co](https://www.playscore.co/blog/scan-sheet-music-into-xml-with-playscore-2/) |
| **Newzik (LiveScore)** | Yes, active 2026 | MusicXML (edit/export) | Not explicitly confirmed | Subscription | GUI/app only | Pairs with StaffPad/Dorico via MusicXML [newzik.com/en/ai](https://newzik.com/en/ai) |
| **MuseScore 4 PDF import** | Yes | MusicXML | Same as Audiveris | Free | Same engine — **is Audiveris under the hood**, already tested | [musescore.org](https://musescore.org/en/node/308411) |
| **Dorico** | Yes (v6, 2025) | MusicXML import only | N/A | N/A | No native OMR — relies on PlayScore/ScanScore/Newzik | Not a new engine |
| **StaffPad** | Yes | — | — | — | Relies on Newzik for scanning; no own OMR | Not new |
| **forScore** | Yes | — | — | — | **No OMR at all**, confirmed | [scoringnotes.com](https://www.scoringnotes.com/resources/the-best-ipad-score-reader-for-most-people/) |
| **PDFtoMusic Pro** (Myriad) | Maintained, dated UI | MusicXML, MIDI | Yes, lyrics recognized | ~$99 commercial | GUI only | **Only works on digitally-generated PDFs from notation software, not photos/scans of printed pages** — not applicable [myriad-online.com](https://www.myriad-online.com/resources/docs/pdftomusicpro/english/index.htm) |
| **iReal Pro** | Yes | Its own chart format | N/A | Paid app | No OCR/image import at all — manual chord entry only, confirmed | [irealpro.com](https://www.irealpro.com/) — dead end |
| **Chordify** | Yes | Its own chart | N/A | Freemium | Audio-based only (mp3/mp4/ogg upload), not sheet-image based | [chordify.net](https://chordify.net/pages/chordify-toolbox/) — not applicable |
| **ChordPulse / Ultimate Guitar** | — | — | — | — | No image/OCR chord-chart feature found in either | Dead end |

## Academic papers (new, not yet covered)
- **"Optical Music Recognition of Jazz Lead Sheets"** — ISMIR 2025 (Daejeon), arXiv [2509.05329](https://arxiv.org/pdf/2509.05329). Directly targets melody+chords+lyrics lead sheets — the closest academic match to this project's exact problem shape. Worth checking for released code/dataset.
- **Musical Form Reconstruction via Chord Symbol OCR** (UCF honors thesis), OMR+grammar+DL baseline for chord identification/localization, has a printed+handwritten Real Book dataset. [stars.library.ucf.edu](https://stars.library.ucf.edu/honorstheses/1462/)
- **MusiXQA** (arXiv [2506.23009](https://pith.science/paper/2506.23009)) — synthetic dataset benchmarking multimodal LLMs on OCR+layout+OMR+chord estimation.
- **LEGATO 2** (arXiv [2607.05769](https://arxiv.org/pdf/2607.05769)) — multimodal sheet-music recognition/understanding model, potential alternative to Qwen3-VL. Check for public weights.

## MEI tooling
No consumer image→MEI product exists. MEI shows up only in academic OMR-evaluation frameworks (arXiv [2312.12908](https://arxiv.org/pdf/2312.12908)) as an interchange format, mostly for early/Gregorian music. **No evidence MEI handles CJK lyrics better than MusicXML** — unverified, likely not worth pursuing.

## Korean-specific services
Found nothing — no dedicated Korean sheet-digitization company/product surfaced (Wooshin/Godpia searches returned irrelevant results). Korean forums/church-tech discussions default to the same Western tools (SmartScore, PhotoScore). This appears to be a genuine market gap, though absence-of-evidence is weak (low confidence).

## ABC notation
Confirmed gap: no tool converts image→ABC directly (per thesession.org community discussion). Standard workflow is OMR→MusicXML→convert (e.g., xml2abc). Not a viable direct path.

## Recommendation
Worth testing, in priority order:
1. **Opuscan** — cheapest to try ($9.99), only tool with an explicit Korean-lyrics OCR claim and syllable alignment; GUI-only but cheap enough for a manual spot-check against existing Audiveris/Qwen3-VL results.
2. **arXiv 2509.05329 (Jazz Lead Sheets OMR)** — read for methodology; check if code/dataset released, since it's the only academic work matching lead-sheet-with-lyrics structure exactly.
3. **LEGATO 2 / MusiXQA** — check for open weights as a possible Qwen3-VL alternative/benchmark.

Not worth testing: SmartScore/PhotoScore/ScanScore/PlayScore2/Newzik (all GUI-only, no CJK edge over what's tested, no API for automation), MuseScore4-PDF-import (same Audiveris engine already tested), PDFtoMusic Pro (wrong input type — needs vector PDFs, not photos), iReal Pro/Chordify/ChordPulse/Ultimate Guitar (none do image-based chord-chart OCR at all — confirms this remains an unaddressed niche).
