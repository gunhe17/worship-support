# Korean STT options for sung-lyric alignment (research as of 2026-09-28)

> Source: Claude research subagent (web). Preserved as reported.

**Bottom line:** Qwen3-ASR is the strongest fit. It has open weights under Apache-2.0, published Korean scores and published singing scores. It also ships a forced aligner (Qwen3-ForcedAligner) that supports Korean. Whisper plus a CTC aligner remains the fallback.

## Comparison table

| Candidate | Weights / API, license | Korean accuracy (published) | Price | Timestamps / alignment | Apple Silicon / T4 |
|---|---|---|---|---|---|
| **Qwen3-ASR 0.6B / 1.7B** (Alibaba) | Open, Apache-2.0 | Fleurs-ko CER 3.72 / 2.57; CommonVoice-ko 8.48 / 5.88; MLC-SLM-ko 10.31 / 8.61 [1] | Free locally. The hosted Flash API is about $0.000035/s ≈ $0.13/hr on OpenRouter (third-party, **official Alibaba price not verified**) | **Qwen3-ForcedAligner-0.6B supports Korean**: 37.2 ms average shift on Korean (MFA-labelled). Max 5 minutes of audio per aligner call [1][2] | Community MLX ports exist: mlx-audio and `qwen3-asr-mlx` (4/5/8-bit, beta) [3]. Fits a T4 at 1.7B in bf16/fp16 (**T4 speed not verified**) |
| Whisper large-v3 / large-v3-turbo | Open, MIT | Improves on large-v2 by 10–20%. **No exact Korean Fleurs number found** | Free locally | Native segment timestamps, plus word timestamps from cross-attention (approximate). WhisperX aligns Korean with `kresnik/wav2vec2-large-xlsr-korean` [4] | mlx-whisper (MPS), whisper.cpp (Metal), faster-whisper (CPU int8 / T4 fp16). Turbo ≈ 809M parameters, large-v3 ≈ 1.55B |
| Korean fine-tuned Whisper, e.g. `ghost613/whisper-large-v3-turbo-korean` (+ a faster-whisper build) | Open; license not stated on the card | Zeroth test: CER 2.06%, WER 4.89% (read speech only) [5] | Free | Same as Whisper | Same as Whisper |
| `seastar105/whisper-medium-ko-zeroth` | Open, Apache-2.0 | Zeroth CER 1.48 [6] | Free | Same as Whisper | Lighter |
| SenseVoice-Small (FunAudioLLM) | Open under a custom "model-license" (**commercial terms not verified**) | No Korean figures published. Trained on speech only [7] | Free | No word timestamps documented | Whisper-small size, very fast on CPU |
| Meta Omnilingual ASR (300M–7B) / MMS | Open, Apache-2.0 [8] | Meta reports CER < 10 for 78% of 1,600+ languages; **Korean not broken out** | Free | MMS_FA CTC aligner works for Korean via uroman romanization [9] | 300M–1B run on CPU/MPS; 7B needs the T4 |
| Moonshine tiny-ko / base-ko | Open (**license not checked**; Moonshine has used a community/non-commercial license for some models) | No figures found | Free | None | Tiny, runs on edge devices [10] |
| NVIDIA Parakeet-TDT-0.6B-v3 / Canary-1B-v2 | Open, CC-BY-4.0 | **No Korean support** (25 European languages only) [11] | — | — | — |
| RTZR (ReturnZero) STT | API | Best average CER, 5.91%, in RTZR's own benchmark on AIHub domain sets (vendor-run) [12] | ₩1,000/hr after 10 free hours; volume discounts down to ₩300–400/hr [13] | Batch and streaming. **Word-timestamp detail not verified** | — |
| Naver CLOVA Speech | API | 7.52% average CER in the same RTZR benchmark [12] | About ₩5 per 10 s ≈ ₩30/min (from a search snippet, **not confirmed on the official price page**) | Long-form transcription. **Word-alignment option not verified** | — |
| Google Chirp 3 | API | Korean is GA | Dynamic batch about $0.003/min (third-party figure, **not verified**) | **No word timestamps on Chirp 3** [14] | — |
| OpenAI | API | — | gpt-4o-mini-transcribe $0.003/min; gpt-transcribe $0.0045/min; gpt-4o-transcribe and whisper-1 $0.006/min [15] | **Only whisper-1** returns word or segment timestamps | — |
| Groq whisper-large-v3-turbo | API | Same as Whisper | **$0.04/hr** [16] | verbose_json segments and words (standard Whisper API; **not checked on Groq's page**) | — |
| Deepgram Nova-3 multilingual | API | Korean supported on Nova-3 and Nova-2 [17] | About $0.0052/min for multilingual pre-recorded (from third-party pages) | Word timestamps | — |
| ElevenLabs Scribe v2 | API | Korean is among 90+ languages | $0.22/hr [18] | Word timestamps | — |
| AssemblyAI | API | Korean is on **Universal-2 only**, in the ">10–25% WER" tier [19] | Universal-2 price not checked (Universal-3.5 Pro is about $0.21/hr but does not support Korean) | Word timestamps | — |

## Caveats for Korean singing

- **Korean-specific singing numbers: none found.** The only published singing figures are Qwen3-ASR's on Chinese and English sets:

  | Dataset | Qwen3-ASR-1.7B WER | GPT-4o-transcribe WER |
  |---|---|---|
  | M4Singer | 5.98 | 16.77 |
  | Opencpop | 3.08 | 7.93 |
  | EntireSongs-zh (full songs with band) | 13.91 | 34.86 |

  EntireSongs-en is 14.60, where Gemini-2.5-Pro scores better (12.18) [2]. No Korean result for Qwen3-ASR or any other model was found.
- Every Korean speech benchmark above (Zeroth, KsponSpeech, AIHub domain sets) is spoken audio. A Zeroth-fine-tuned Whisper may do worse on singing than base large-v3. Treat those numbers as speech-only.
- The only Korean-singing ASR paper found is on folk songs (HuBERT adapted from English), and it would not load (403) [20]. LyricWhiz (Whisper + GPT-4) reports multilingual lyrics transcription working [21]. No public K-pop lyrics ASR benchmark was found.
- Whisper is known to hallucinate or loop on long instrumental passages. Run VAD or Demucs first, and consider `condition_on_previous_text=False` (general knowledge, not verified for this report).
- Stretched vowels in singing make word-level ASR timings unreliable. Forced alignment against the known lyrics is much more robust than free transcription.

## Recommendations

**(a) Best local option on M3 or T4: Qwen3-ASR-1.7B.** On the M3, use the MLX ports. On the T4, use the official transformers/vLLM package. Fallback: **mlx-whisper large-v3-turbo** on the M3, or faster-whisper large-v3 (fp16) on the T4. Run everything on the Demucs vocal stem.

**(b) Cheapest acceptable API: Groq whisper-large-v3-turbo at $0.04/hr.** For better accuracy on Korean speech, RTZR (about ₩1,000/hr, or about ₩300–400/hr at volume) led a Korean-domain benchmark, but that benchmark was run by RTZR itself. Among global APIs, ElevenLabs Scribe v2 costs $0.22/hr and gives word timestamps. OpenAI's gpt-4o and gpt-transcribe models have no timestamps, and Chirp 3 has no word timestamps, so neither suits the alignment job.

**(c) Lyric sections when the text is already known: skip free transcription and force-align.**
1. Take the Demucs vocal stem.
2. Run **Qwen3-ForcedAligner-0.6B** with the known lyric text (Korean supported, 5 minutes per call — chunk or align per section).
3. Fallback aligners: torchaudio **MMS_FA** with uroman-romanized lyrics (torchaudio alignment APIs may be deprecated in recent releases; not checked), or WhisperX's Korean wav2vec2 model (`kresnik/wav2vec2-large-xlsr-korean`).
4. Because worship songs repeat choruses: transcribe roughly with ASR, fuzzy-match each ASR segment to the section texts by character edit distance, and assign the section label. Use per-section forced alignment only where the matching is ambiguous.

## Sources
[1] https://huggingface.co/Qwen/Qwen3-ASR-1.7B
[2] https://arxiv.org/html/2601.21337v1
[3] https://github.com/Blaizzy/mlx-audio ; https://pypi.org/project/qwen3-asr-mlx/
[4] https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py
[5] https://huggingface.co/ghost613/whisper-large-v3-turbo-korean
[6] https://huggingface.co/seastar105/whisper-medium-ko-zeroth
[7] https://huggingface.co/FunAudioLLM/SenseVoiceSmall
[8] https://github.com/facebookresearch/omnilingual-asr
[9] https://docs.pytorch.org/audio/stable/tutorials/forced_alignment_for_multilingual_data_tutorial.html
[10] https://huggingface.co/UsefulSensors/moonshine-tiny-ko
[11] https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
[12] https://github.com/rtzr/Awesome-Korean-Speech-Recognition
[13] https://www.rtzr.ai/pricing
[14] https://docs.cloud.google.com/speech-to-text/v2/docs/chirp_3-model
[15] https://developers.openai.com/api/docs/pricing
[16] https://console.groq.com/docs/model/whisper-large-v3-turbo
[17] https://developers.deepgram.com/docs/models-languages-overview
[18] https://elevenlabs.io/pricing/api
[19] https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages
[20] https://www.mdpi.com/2076-3417/14/18/8532
[21] https://arxiv.org/html/2306.17103v4
