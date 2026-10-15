I'll research Korean worship-sheet vision/OCR across X and the web, then compare vision LLMs, Korean OCR APIs, and OMR for lyrics+chords. Starting with the research workflow and current model/pricing sources.The request is comparison research with citations, not a local implementation. I’ll pull vendor pages, papers, and X reports in parallel so the table can separate verified numbers from UNVERIFIED claims.I have enough vendor and paper coverage to start filling the table. Next I’ll pull OMR papers, official pricing, and X reports on lyrics-plus-chords extraction.Korean line-level numbers are in. I’ll pull official pricing and the remaining model cards so the table can distinguish published figures from UNVERIFIED ones.**For Korean worship lead sheets (staff + chord symbols + Hangul lyrics), people who get usable `{sections, lyrics, chords, key, time, tempo}` JSON use a vision LLM (or a small OCR VLM) prompted for structure — not dedicated OMR.** OMR engines transcribe notes; they do not solve lyrics+chords. Musi𝕏QA shows the split: GPT-4o OCR accuracy 68.9% vs OMR 4.0% on synthetic scores ([arxiv.org/html/2506.23009v1](https://arxiv.org/html/2506.23009v1)). A worship-media pipeline (Morning Star Praise) does exactly this: Vision LLM (Gemini / GPT-4o / Qwen-VL / Claude) to separate lyrics from chords, PaddleOCR as fallback, oemer only to crop staves ([personal-showcase.leveo.workers.dev](https://personal-showcase.leveo.workers.dev/)). SongSight AI uses OpenAI Vision for chords+lyrics and **explicitly does not support staff notation** ([sonametro.com/songsight](https://www.sonametro.com/songsight)).

No published Hangul-on-lead-sheet CER exists. Korean numbers below are **document/scene OCR**, not worship scores. Chord-over-lyric alignment is the failure mode people actually complain about ([x.com/MichaelInDev](https://x.com/MichaelInDev/status/2099575954167242991)).

---

## What works for lyrics+chords (not notes)

| Approach | Verdict for this JSON | Evidence |
|---|---|---|
| **Vision LLM + JSON schema** | **This is what people ship** | Worship pipeline: Gemini/GPT-4o/Qwen-VL ([leveo](https://personal-showcase.leveo.workers.dev/)). Folk-score lyrics VLMs ([Springer](https://link.springer.com/chapter/10.1007/978-3-031-73497-7_8)). ChatGPT used to transcribe chords above lyrics ([x.com/JnBrymn](https://x.com/JnBrymn/status/2102890823788425555)). |
| **Korean OCR API then LLM parse** | Good for Hangul dump; weak on chords/sections/repeats | CLOVA/Upstage/Google return lines+boxes, not Verse/Chorus/D.S. |
| **Dedicated OMR** | **Wrong tool** for lyrics+chords | Audiveris: notes + Tesseract lyrics; CJK added in 5.7.0 ([GitHub 5.7.0](https://github.com/Audiveris/audiveris/releases/tag/5.7.0)), older Korean-lyrics request ([issue 515](http://gitmemories.com/index.php/Audiveris/audiveris/issues/515)). oemer/homr: pitch/rhythm, no lyrics ([homr README](https://github.com/liebharc/homr)). SMT: MusicXML notes, no Hangul lyrics. GOT-OCR2.0 “sheet music” = Western symbols, Korean word acc **0.59%** ([arXiv 2609.24058](https://arxiv.org/pdf/2609.24058)). |

Repeats, D.S. al Fine, 1st/2nd endings, V/C/A/B tags: **UNVERIFIED** on all systems for Korean lead sheets. Frontier VLMs can often *read* those printed words; they do not reliably reconstruct form.

---

## A. Vision LLMs / OCR VLMs

**Price assumption:** ~2k input tokens (image+prompt) + ~800 output tokens per page. Marked **est.** Token rates are official unless noted.

| Model | Korean OCR (published) | Price | Weights / license | M3 24GB MLX | Kaggle T4 16GB |
|---|---|---|---|---|---|
| **Claude Opus 5.5** | No Hangul-OCR CER. CJK F1 88.3% on Railwail 1k screenshots (Opus **4.7**, not 5.5) ([railwail](https://railwail.com/en/blog/claude-gpt-gemini-vision-benchmark)). Korean MMLU-rel. 96.6% (language, not OCR) ([docs.claude.com](https://docs.claude.com/en/docs/build-with-claude/multilingual-support)). Roboflow OCR 87.8%, rank #39/60 ([roboflow](https://playground.roboflow.com/models/anthropic/claude-opus-5-5)). | **$4 / $20 per 1M** in/out ([anthropic.com](https://www.anthropic.com/claude/opus)); **est. ~$0.024/img** | Closed | No | No |
| **Claude Sonnet 5.5 / 5** | No Hangul-OCR CER. | **$2 / $10 per 1M** ([platform.claude.com](https://platform.claude.com/docs/en/models/sonnet-5-5/overview.md)); **est. ~$0.012/img** | Closed | No | No |
| **Gemini 3.1 Pro** | CJK F1 **92.4%** (best of 3 on Railwail CJK) ([railwail](https://railwail.com/en/blog/claude-gpt-gemini-vision-benchmark)). Korean-specific sheet CER: **UNVERIFIED**. | **$2 / $12 per 1M** (≤200k) ([ai.google.dev](https://ai.google.dev/gemini-api/docs/pricing)); **est. ~$0.014/img** | Closed | No | No |
| **Gemini 2.5 Pro** | Strong CJK in 2026 writeups; no Hangul-sheet CER. | **$1.25 / $10 per 1M** (≤200k) ([cloud.google.com](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing?hl=ko)); **est. ~$0.011/img** | Closed | No | No |
| **Gemini 2.5 Flash / 3.x Flash** | Flash variants often beat Pro on OCR leaderboards ([roboflow blog](https://blog.roboflow.com/best-ocr-models-text-recognition/)). Korean PDF: anecdotal “검수 안 해도 될만큼” ([x.com/gnutel](https://x.com/gnutel/status/1920224919314444660)). | 2.5 Flash **$0.30 / $2.50**; 3.8 Flash **$0.75 / $3.75** through 2026-12-31; 2.5 Flash-Lite **$0.10 / $0.40** ([ai.google.dev](https://ai.google.dev/gemini-api/docs/pricing)). **est. Flash ~$0.0026; Lite ~$0.0005/img**. Free tier exists. | Closed | No | No |
| **GPT-5 / GPT-5.6 / GPT-4o** | CJK F1 89.7% (GPT-5.4) ([railwail](https://railwail.com/en/blog/claude-gpt-gemini-vision-benchmark)). GPT-4o Musi𝕏QA OCR 68.9% / OMR 4.0% ([Musi𝕏QA](https://arxiv.org/html/2506.23009v1)). | GPT-5 **$1.25 / $10**; GPT-4o **$2.50 / $10**; GPT-5.6 Luna **$0.20 / $1.20**; GPT-5.6 Sol **$4 / $20** ([developers.openai.com](https://developers.openai.com/api/docs/pricing), [openai.com](https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/)). **est. Luna ~$0.0014; GPT-5 ~$0.011; 4o ~$0.013/img** | Closed | No | No |
| **Qwen3-VL 2B/4B/8B/32B** | 32 languages, Korean included ([HF 32B](https://huggingface.co/Qwen/Qwen3-VL-32B-Instruct/blame/main/README.md)). Qwen2.5-VL-72B Korean **edit dist 0.056** ([PaddleOCR-VL paper](https://arxiv.org/html/2510.14528v2)). Qwen3.5-9B Korean **word acc 80.27%** on TextMuSS ([arXiv 2609.24058](https://arxiv.org/pdf/2609.24058)). Qwen3-VL-4B 5-bit: “works pretty well in Korean” on **M3 Air 24GB** ([x.com/SOSOHAJALAB](https://x.com/SOSOHAJALAB/status/1978237077042151779)). OCRBench 8B Instruct ~89.6% **UNVERIFIED** (third-party table). | Local: $0. Hosted ~$0.60/MTok **UNVERIFIED** (aggregator). | **Apache 2.0**, open ([HF](https://huggingface.co/Qwen/Qwen3-VL-32B-Instruct/blame/main/README.md)) | **Yes:** 4B ~3GB, 8B ~6GB 4-bit ([VLMKit](https://github.com/john-rocky/VLMKit)). 32B 4-bit ~18–21GB: **tight on 24GB**, OK on M3 Max 48GB ([openclawradar](https://openclawradar.com/article/apple-silicon-benchmark-qwen3-vl-performance-m3-m4-m5-max-vision-llm-classification)) | **Yes:** 4B/8B Q4. **32B Q4 ~20GB: no** |
| **InternVL3 / 3.5** | InternVL3.5-8B Korean **word acc 38.88%** (weak) ([arXiv 2609.24058](https://arxiv.org/pdf/2609.24058)). OCRBench InternVL3-8B 880/1000 ([pdf 2504.10479](https://arxiv.org/pdf/2504.10479)). | Local $0 | **MIT** (check LLM backbone) ([aifoss](https://aifoss.dev/blog/open-source-vlm-guide-2026/)) | 8B 4-bit ~6–8GB: **yes**. 78B: **no** | 8B INT8/4-bit: **yes**. 14B+: tight |
| **MiniCPM-V 4.x** | OCRBench 862 (4B) ([InternVL3.5 pdf](https://arxiv.org/pdf/2508.18265v2.pdf)). Korean sheet CER: **UNVERIFIED**. 32 languages claimed in third-party atlas **UNVERIFIED**. | Local $0 | Apache-2.0 code; OpenBMB weight terms ([OCR-Master-Guide](https://github.com/Ringmast4r/OCR-Master-Guide/blob/main/docs/02-engine-atlas.md)) | 4B/8B 4-bit: **yes** | **yes** |
| **Llama 4 vision (Scout/Maverick)** | No published Korean OCR. Llama 4 Maverick visual-understanding 59.7% Roboflow legacy ([roboflow](https://playground.roboflow.com/models/anthropic/claude-4-5-sonnet)). | Hosted Scout ~$0.11/MTok **UNVERIFIED** ([awesomeagents](https://awesomeagents.ai/pricing/multimodal-vision-api-pricing/)) | Llama 4 community license (not Apache) | Scout MoE: **no** on 24GB at useful quant | Scout: **no**. Smaller Llama 3.2-11B 4-bit: maybe |
| **dots.ocr (~1.7–3B)** | ~100 langs; Korean sheet CER **UNVERIFIED**. olmOCR-Bench 79.1 ([github README](https://github.com/rednote-hilab/dots.ocr/blob/master/README.md)) | Local $0 | **MIT** | 4-bit ~2–4GB: **yes** (MLX path **UNVERIFIED**) | **yes** (~2–3.5GB) |
| **GOT-OCR2.0 580M** | Paper: EN+ZH. Korean word acc **0.59%** ([arXiv 2609.24058](https://arxiv.org/pdf/2609.24058)). Claims “sheet music” as a character class (Western, via Verovio) ([transformers docs](https://github.com/huggingface/transformers/blob/main/docs/source/en/model_doc/got_ocr2.md)) | Local $0 | **Apache 2.0** | **yes** (~2GB) | **yes** |
| **olmOCR / olmOCR 2 ~7–8B** | HF blog: **English-only** for olmOCR-2 ([huggingface.co/blog/ocr-open-models](https://huggingface.co/blog/ocr-open-models)). 12GB VRAM ([koncile](https://www.koncile.ai/en/ressources/10-open-source-ocr-tools-you-should-know-about)) | Local $0; paper $190/M pages on L40S ([arxiv 2502.18443](https://arxiv.org/html/2502.18443v1)) | Apache 2.0 | 4-bit ~8GB: **yes**, Korean: **no** | **yes** (tight at fp16) |
| **MinerU 2.5** | Korean edit dist **0.917** (essentially broken Hangul) ([PaddleOCR-VL paper](https://arxiv.org/html/2510.14528v2)) | Local $0 | **AGPL-3.0** | 1.2B: **yes** | **yes** |
| **PaddleOCR-VL 0.9B** | **Best published Korean among open OCR VLMs:** edit dist **0.052**; Korean listed in 109 langs ([arxiv 2510.14528](https://arxiv.org/html/2510.14528v2), [paddle docs](https://paddlepaddle.github.io/PaddleOCR/v3.7.0/en/version3.x/algorithm/PaddleOCR-VL/PaddleOCR-VL.html)). TextMuSS Korean word acc **68.78%** ([arXiv 2609.24058](https://arxiv.org/pdf/2609.24058)). OmniDocBench v1.5 **92.56** | Local $0. MLX 6-bit ~3.3GB ([mlx-local-inference](https://github.com/bendusy/mlx-local-inference)) | **Apache 2.0** | **yes** | **yes** (~1–2GB) |
| **Nanonets-OCR2-3B** | Trained including Korean ([nanonets.com](https://nanonets.com/research/nanonets-ocr-2/)). No Hangul CER. olmOCR-Bench 69.5 ([arxiv 2603.13032](https://arxiv.org/html/2603.13032v2)) | Local $0; SaaS **UNVERIFIED** | **3B: Qwen Research (non-commercial)**; 1.5B-exp Apache 2.0 ([HF discussion](https://huggingface.co/nanonets/Nanonets-OCR2-3B/discussions/2)) | 4-bit ~4GB: **yes** | **yes** |

---

## B. Korean OCR APIs

These read Hangul. They do **not** emit chord-aligned sections. Use as a lyrics dump, then a VLM for structure.

| Service | Korean | Price | Fit for lead sheets |
|---|---|---|---|
| **Naver CLOVA OCR** (General, `lang=ko`) | Native Hangul engine ([ncloud API](https://api.ncloud-docs.com/docs/en/ai-application-service-ocr-ocr)). 2023 SK test: Hangul “상” vs Google/Azure “중상” ([devocean.sk.com](https://devocean.sk.com/blog/techBoardDetail.do?ID=165524)). **97–99% UNVERIFIED** (2026 blog, not a public bench) ([imagetotable.ai](https://imagetotable.ai/blog/korean-document-extraction-market-cost-comparison)). | Official KR list not retrieved. Secondary: ~₩3/call (2023) or ~₩50/page (2026 blog) — **UNVERIFIED**. Free 300 calls/mo in 2023 SK table. Template domains have monthly base fees ([ncloud FAQ](https://www.ncloud.com/v2/support/faq/prod/436?categoryCode2=AI&categoryCode3=SV_0117)). | Best Hangul lines+boxes. No chords/sections. |
| **Upstage Document Parse / OCR** | Korean-first vendor. DP-Bench TEDS **96.06** (Mar 2026, not Hangul-only) ([Upstage PDF](https://file.aichallenge4all.or.kr/notices/1775173912481_%EC%97%85%EC%8A%A4%ED%85%8C%EC%9D%B4%EC%A7%80-AI_%EB%AA%A8%EB%8D%B8_%EB%B0%8F_API_%ED%99%9C%EC%9A%A9%EB%B2%95.pdf)). | **OCR $0.0015/page; Parse $0.01 std / $0.03 enhanced** ([upstage.ai/pricing](https://www.upstage.ai/pricing/api)) | Cheap structured markdown. Chord alignment **UNVERIFIED**. |
| **Google Cloud Vision** `DOCUMENT_TEXT_DETECTION` | Korean supported; 200+ langs. Printed ~95% **UNVERIFIED** (DeltOCR, not Hangul-only) ([imagetotable 2026](https://imagetotable.ai/blog/google-vs-aws-vs-azure-ocr-2026)). | **$1.50 / 1k units** after 1k free/mo = **$0.0015/img** ([same](https://imagetotable.ai/blog/google-vs-aws-vs-azure-ocr-2026)) | Cheap Hangul. No music structure. |
| **Azure Document Intelligence** Read/Layout | Printed Korean; handwriting `ko` ([Azure language support](https://docs.azure.cn/en-us/ai-services/computer-vision/language-support)). Printed ~96% **UNVERIFIED**. | Read **$1.50 / 1k pages**; Layout **$10 / 1k** ([notcheapai](https://notcheapai.com/guides/azure-vs-google-vs-aws-ocr-cost-per-1000-pages-2026/), [Azure pricing](https://azure.microsoft.com/ko-kr/pricing/details/ai-document-intelligence/)) | Layout boxes useful; still not chords. |

---

## C. Dedicated OMR

| System | Notes | Korean lyrics under staff | License | Local |
|---|---|---|---|---|
| **Audiveris** | Full OMR + Tesseract text; chord-name and lyrics switches exist ([handbook](https://audiveris.github.io/audiveris/_pages/guides/main/book_parameters/)). CJK UI/chars in 5.7.0 ([release](https://github.com/Audiveris/audiveris/releases/tag/5.7.0)). 2021 user: Korean lyrics not recognized ([issue](http://gitmemories.com/index.php/Audiveris/audiveris/issues/515)). | **Partial / unproven.** Tesseract `kor` can be installed; no published Hangul-lyric CER. | AGPL-3.0 | CPU; M3/T4 fine |
| **oemer** | Staff/note segmentation → MusicXML. **No lyrics pipeline** ([github](https://github.com/meteo-team/oemer)). | **No** | check repo (unmaintained fork) | T4 yes; M3 via CPU/ONNX **UNVERIFIED** |
| **Sheet Music Transformer** | End-to-end MusicXML for polyphony ([Springer](https://link.springer.com/chapter/10.1007/978-3-031-70552-6_2)). No lyric/Hangul head. | **No** | research | GPU; 16GB maybe |
| **homr** | Pitch+rhythm; “neglecting dynamics, articulation…”; RapidOCR in deps for some text but **not Korean lyrics** ([README](https://raw.githubusercontent.com/liebharc/homr/main/README.md)). AGPL. | **No** | AGPL-3.0 | T4 yes (ONNX) |
| **GOT-OCR2.0** | “Sheet music” as optical characters (Western). Korean **0.59%** word acc. | **No** for Hangul | Apache 2.0 | yes |
| **Legato 2** | First neural OMR to emit **embedded text** (titles/annotations), English IMSLP piano ([arxiv 2607.05769](https://arxiv.org/html/2607.05769)). Korean: **UNVERIFIED / unlikely**. | **UNVERIFIED** | research | GPU |
| **EnPu** | Chinese **numbered-notation** worship OMR (PaddleOCR + geometry) — analog, not Korean staff lead sheets ([github.com/loootte/EnPu](https://github.com/loootte/EnPu)). | N/A (简谱, not 오선) | Apache-2.0 | yes |

---

## Recommendations (as of 2026-09-29)

### 1) Best local on M3 24GB / Kaggle T4 16GB

**PaddleOCR-VL 0.9B (Apache 2.0) + Qwen3-VL-8B-Instruct 4-bit (Apache 2.0).**

- PaddleOCR-VL has the only **published** strong Korean line OCR among compact open VLMs (edit dist 0.052) and fits both machines ([arxiv 2510.14528](https://arxiv.org/html/2510.14528v2), [HF](https://huggingface.co/PaddlePaddle/PaddleOCR-VL)).
- Qwen3-VL-8B is the model you prompt for `{sections:[{tag, lyrics, chords}], key, time_signature, tempo}`. 4-bit ~6GB; Korean OCR without finetune reported on **M3 Air 24GB** at 4B ([x.com/SOSOHAJALAB](https://x.com/SOSOHAJALAB/status/1978237077042151779)). MLX: `mlx-community/Qwen3-VL-8B-Instruct-4bit`. T4: GGUF Q4_K_M ~6GB + mmproj ([codersera](https://codersera.com/blog/qwen3-vl-4b-vs-qwen3-vl-8b-benchmarks-vram-guide/)).
- Skip 32B on T4. On M3 24GB, 32B 4-bit (~18GB) is swap-risky; 8B is the practical pick.
- Do **not** use MinerU, GOT-OCR2.0, or olmOCR for Hangul.

### 2) Cheapest API

**Gemini 2.5 Flash-Lite** (free tier, then **$0.10 / $0.40 per 1M**, **est. ≪ $0.001/page**) or **Upstage Document OCR at $0.0015/page** if you only need a Hangul dump ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Upstage](https://www.upstage.ai/pricing/api)).

For **lyrics+chords JSON in one call**, cheapest *capable* APIs: **Gemini 2.5 Flash (~$0.003/img est.)** or **GPT-5.6 Luna ($0.20/$1.20, est. ~$0.0014)**. Google Vision at $0.0015/img is cheaper than Flash for raw text but will not structure chords.

### 3) Best accuracy regardless of cost

**Gemini 3.1 Pro (or 3.x Flash if Pro is overkill) with a strict JSON schema, high-res crop of each system.** Gemini won CJK OCR F1 **92.4%** vs GPT-5.4 89.7% vs Claude Opus 4.7 88.3% on a 1k-image screenshot set ([railwail](https://railwail.com/en/blog/claude-gpt-gemini-vision-benchmark)); Korean users independently called Gemini “검수 안 해도 될만큼” on scanned PDFs ([x.com/gnutel](https://x.com/gnutel/status/1920224919314444660)). Escalate hard pages to **Claude Opus 5.5** or **GPT-5.6 Sol** for section/repeat reasoning — not because their OCR is better (Roboflow: Opus 5.5 OCR is mid-pack).

**Do not pay for OMR** if the target is lyrics+chords. If you also want notes, run homr/Audiveris **in parallel** and merge; do not expect one model to do both well ([Musi𝕏QA](https://arxiv.org/html/2506.23009v1)).

**Practical pipeline:** crop each staff-system → Gemini Flash or Qwen3-VL-8B with a schema that asks for `tag`, `lyrics[]` (Hangul lines under the staff), `chords[]` aligned by lyric syllable/measure, plus page-level `key` / `time_signature` / `tempo` from the header → human-fix D.S./endings. Optional: CLOVA or PaddleOCR-VL as a Hangul verifier when the VLM drops a syllable.

---

**Gaps (all UNVERIFIED):** Hangul-on-lead-sheet CER for every model; chord-to-lyric column alignment rates; D.S. al Fine / 1st–2nd ending recovery; current Naver CLOVA per-call KRW on ncloud.com; MLX builds of PaddleOCR-VL quality vs CUDA.
