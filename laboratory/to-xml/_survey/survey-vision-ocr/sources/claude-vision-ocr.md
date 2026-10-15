# Vision models for Korean worship lead sheets → JSON (verified 2026-09-29)

> Source: Claude research subagent (web). Preserved as reported.

Scope note: **nothing found benchmarks this exact task** (Korean lyrics + chord symbols + section markers → JSON). Everything below is inference from adjacent, verified evidence. Verified facts carry URLs; guesses are marked ⚠️.

## 1. Frontier vision APIs

| Model | Input / Output $/MTok | Image cost | Max res | Strict JSON | Korean/doc evidence |
|---|---|---|---|---|---|
| Claude Sonnet 5.5 | $2 / $10 | ⌈w/28⌉×⌈h/28⌉ visual tokens, capped **4784** (hi-res tier, 4.7+); ~$0.010/page ⚠️est | 8000×8000 in, downscaled to 2576px long edge | Yes, `output_config.format: json_schema`, constrained decoding | Claude 3.5 Sonnet scored 76.5 Korean-OCR on KOFFVQA — weakest of the frontier trio there |
| Claude Haiku 4.5 | $1 / $5 | standard tier, cap 1568 tokens → ~$0.0016/page ⚠️est | 1568px long edge | Yes | no Korean number found |
| Claude Opus 5.5 | $4 / $20 | ~$0.019/page ⚠️est | 2576px | Yes | — |
| Gemini 3.1 Pro Preview | $2 / $12 | 258 tok per 768×768 tile (258 total if ≤384px); `media_resolution` caps budget | 3600 images/req | responseSchema | **Gemini3-Pro is the most robust model on MDPBench** (17 languages incl. Korean) |
| Gemini 3.8 / 3.7 / 3.6 Flash | $0.75 / $3.75 (rises to $1.50 on 2027-01-01) | ~$0.002/page ⚠️est | same | Yes | Gemini-2.0-flash scored **93.5 Korean OCR** (KOFFVQA) |
| Gemini 3.1 Flash-Lite | $0.25 / $1.50 | ~$0.0007/page ⚠️est | same | Yes | ⚠️ no Korean number |
| GPT-6-luna | $0.10 / $0.50 (vision: yes) | ~$0.0003/page ⚠️est | ⚠️ unverified | Structured Outputs | — |
| GPT-6-sol / astra | $2/$10, $10/$50 | — | — | Yes | GPT-4o was #1 overall on KOFFVQA (82.0 overall, **91.5 Korean OCR**) |
| Note | **gpt-5, 5.1, 5.2, 5-mini/nano, o3 do NOT accept images** | | | | |

Sources: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Claude vision (token formula, limits)](https://platform.claude.com/docs/en/build-with-claude/vision) · [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Gemini image tokenization](https://ai.google.dev/gemini-api/docs/image-understanding) · [OpenAI pricing](https://developers.openai.com/api/docs/pricing) · [KOFFVQA](https://arxiv.org/pdf/2503.23730) · [MDPBench](https://www.alphaxiv.org/abs/2603.28130)

## 2. Open-weight VLMs
- **Qwen3-VL** — Apache 2.0, dense 2B/4B/8B/32B + MoE 30B-A3B/235B-A22B; OCR extended to **32 languages**, explicitly robust to low light/blur/tilt ([repo](https://github.com/qwenlm/qwen3-vl)). Qwen3-VL-32B-Thinking is **#1 open model on OCRBench-V2(en), 0.684**; Qwen3-VL-235B = 89.78 OmniDocBench v1.6. Qwen2-VL-72B hit **94.5 on Korean OCR vs GPT-4o's 87.8**, and Qwen2.5-VL-72B scored **95.0 Korean OCR on KOFFVQA** — the Qwen family is the strongest open bet for Korean. MLX builds exist (`mlx-community/Qwen3-VL-4B-Instruct-*`, `lmstudio-community/Qwen3-VL-30B-A3B-Instruct-MLX-4bit`); 30B-A3B 4-bit peaks ~**20.5 GB unified memory** — fits 24 GB M3 but tight. A cached 4B-8bit needs ~5–6 GB ⚠️est.
- **InternVL3/3.5, MiniCPM-V/o 4.5, GLM-4.6V, Kimi-VL, Molmo2** all still active; Apache/MIT for MiniCPM-o 4.5, GLM, Molmo 2; Kimi uses its own license; **InternVL checkpoints inherit component licenses** ([survey](https://news.ycombinator.com/item?id=47247663), [turingpost](https://www.turingpost.com/p/10-open-mllms)). ⚠️ No Korean OCR numbers found for any of these.
- **Llama 4 vision** — ⚠️ could not verify any current Korean OCR data; effectively superseded.

## 3. Specialized open OCR
| Model | Korean? | Output | Score |
|---|---|---|---|
| PaddleOCR-VL (0.9B, Apache 2.0) | **Yes, 109 langs incl. Korean** | Markdown/JSON layout | 96.34 OmniDocBench v1.6 (top) |
| MinerU2.5-Pro (~1.2B, Apache 2.0) | 109 langs | SVG/JSON/Markdown | 95.75 |
| dots.ocr / dots.mocr (~1.7–3B, MIT) | 100+ langs; Korean measured | Markdown + layout | 1374 on Datalab **Korean** bench; 83.9 olmOCR-Bench |
| olmOCR 2 (8B) | **English-only** | Markdown | 1400 Korean bench (but not designed for it) |
| Chandra / Surya (Datalab) | Yes | Markdown | **Chandra+enhancements = 1858, best Korean score measured** |
| GLM-OCR (0.9B, MIT) | 8 langs, **Korean not listed** | Markdown | 95.22 |
| GOT-OCR2.0, Nanonets-OCR-s | ⚠️ Korean unverified / Nanonets claims 200+ langs | Markdown | — |

Sources: [Roboflow OCR ranking](https://blog.roboflow.com/best-open-source-ocr-models/) · [Datalab Korean benchmark](https://www.datalab.to/benchmark/korean) · [PaddleOCR-VL paper](https://arxiv.org/html/2510.14528v1)

**None of these emit chords-grouped-by-section.** They give text + layout boxes; section grouping and chord/lyric pairing is post-processing.

## 4. Korean commercial OCR
- **Upstage Document Parse**: **$0.01/page** standard, **$0.036/page** enhanced; markets Korean + complex layout accuracy ([pricing](https://www.upstage.ai/pricing/api)).
- **Azure Document Intelligence**: Read $1.50/1k pages, Layout $10/1k, free F0 tier 500 pages/mo (first 2 pages only).
- **Google Cloud Vision** text detection: $1.50/1k units, first 1k/mo free.
- **Naver CLOVA OCR**: pay-as-you-go, **⚠️ exact per-call price not published** — behind the ncloud console; all plans except General OCR carry a monthly maintenance fee regardless of usage ([docs](https://guide.ncloud-docs.com/docs/en/clovaocr-spec)).

## 5. Dedicated OMR — **lyrics are essentially unsupported**
- **Audiveris**: lyrics OCR via Tesseract for **English/Latin/German/French**; extra language packs possible but **⚠️ no Korean evidence**, and Hangul under a staff with hyphen-splits is far outside its text model.
- **oemer / homr**: pitch + rhythm only; homr explicitly "neglects dynamics, articulation, …" — **no lyrics, no section markers** ([homr](https://github.com/eerovil/homr), [oemer](https://github.com/BreezeWhite/oemer)).
- **Sheet Music Transformer** (ICDAR 2024) → notes only. The lyrics work is **AMNLT** ([arXiv 2412.04217](https://arxiv.org/pdf/2412.04217)) — joint music+lyrics transcription, but only on **Gregorian chant** (Latin), 4 datasets, new AMLER/AlER metrics. Not Korean, not chord charts.
- **Verdict: no OMR tool reads Korean lyrics or Verse/Chorus/D.S. markers. Do not go down this path.**

## 6. What actually works (evidence)
- **MusiXQA** ([arXiv 2506.23009](https://arxiv.org/html/2506.23009v1)) is the closest real data point and it is encouraging: GPT-4o hit **68.9% on OCR-type tasks (title, composer, tempo/BPM, time signature, explicitly-printed chord names)** but collapsed to **4.0% on note-level OMR** (8.4% with RAG). A spec of lyrics + printed chords + key/tempo with **no note transcription** sits squarely in the 68.9% half. This is the single strongest argument for the design.
- **MusicSheetViewer** ([PRs #9/#11/#13/#16](https://github.com/gunther520/MusicSheetViewer/pull/16)) is a live vision-LLM chord-chart reader: crops staff bands, sends bands to a vision model, snaps detections to chord tracks, falls back to Tesseract. Its fix log names the real failure modes: **slash-chord anatomy (A/B → chord vs bass), missing repeated occurrences, jazz glyphs (△ = maj7)**.
- [VLM lyrics extraction from folk sheets](https://link.springer.com/chapter/10.1007/978-3-031-73497-7_8) (2024) asks exactly "can VLMs replace a bespoke OCR model for lyrics?" — ⚠️ **paywalled, results unverified.**
- [`noten`](https://github.com/Party4Bread/noten): token-efficient LLM-parseable chord format — better output target than raw JSON-with-prose.

### Known failure modes to design around
1. **Hyphen-split syllables** ("눈 부신- 햇 살 -") — models either drop the hyphens or re-join wrongly; treat hyphen as a join hint, post-process, don't trust the model.
2. **Chord-to-lyric horizontal alignment** — a chord above a syllable is a *spatial* relation; LLMs read in reading order and drift. MusicSheetViewer solved this by snapping to staff bands, not by prompting.
3. **Repeat structure** (%, 1st/2nd endings, D.S. al Fine) — MusiXQA shows repeat-section detection is a distinct weak task; expect the model to linearize wrongly. Extract markers as *tags*, don't ask it to unroll them.
4. **Under-counting repeated chords** — verified real fix in MusicSheetViewer.
5. **Multi-column / two-staff-per-line layouts** → reading-order errors; KRETA found degradation across varied layouts ([arXiv 2508.19944](https://arxiv.org/pdf/2508.19944)).
6. **Downscaling kills small Hangul** — Claude standard tier caps at 1568px long edge; pre-crop per system instead of sending a full A4 page.

## Recommendations
**(a) Local.** M3 24 GB: **Qwen3-VL-8B-Instruct 4/8-bit MLX** as the working target (~6–10 GB ⚠️est) — benchmark 4B → 8B on a real 20-sheet set before spending. 30B-A3B-4bit MLX (~20.5 GB) is the accuracy ceiling that still fits, at painful headroom. Kaggle T4 16 GB: Qwen3-VL-8B in 4-bit, or run **PaddleOCR-VL (0.9B)** for the Korean text layer and let a small LLM do grouping. Pipeline that actually wins locally: **PaddleOCR-VL/dots.ocr for Hangul text+boxes → geometry code pairs chords to syllables → tiny LLM for section tagging.** Don't ask one 4B model to do all three.

**(b) Cheapest acceptable API.** **Gemini 3.1 Flash-Lite** ($0.25/$1.50, ~$0.0007/page ⚠️est) — the Flash line has the best *verified* Korean OCR evidence (93.5 KOFFVQA) and native responseSchema. If quality is short, step to **Gemini 3.6 Flash** at $0.75. Non-LLM floor: **Upstage at $0.01/page** with genuinely Korean-tuned layout parsing.

**(c) Best accuracy regardless of cost.** **Gemini 3.1 Pro Preview** — the only model with published robustness on a Korean-inclusive document-parsing benchmark (MDPBench). Cross-check with **Claude Opus 5.5**, whose hi-res tier (2576px, 4784 visual tokens) preserves small Hangul better than the 1568px standard tier, and whose constrained-decoding JSON schema removes a whole class of parse failures. Two-model agreement on chord strings is worth more than either alone.

**Do first:** crop to one staff system per image, run Gemini 3.6 Flash and a cached Qwen3-VL-4B-8bit on 20 real sheets, score lyrics CER and chord-sequence exact-match separately. Section tags and chord/lyric alignment will fail differently than the OCR does, and no published benchmark will tell you which.
