# 한국어 STT 조사 (로컬 / 저렴한 API)

- 조사일: 2026-09-28
- 용도: 찬양 음원에서 **노래로 부른 한국어 가사**를 인식하고 시간 정렬하기(어느 구간에서 어떤 가사가 나오는지). 일반 한국어 음성 인식도 포함
- 원문: [sources/claude-korean-stt.md](sources/claude-korean-stt.md) (Claude, 웹) · [sources/grok-korean-stt.md](sources/grok-korean-stt.md) (Grok, X와 웹)

## 핵심
- **한국어 노래(가창) 인식 성능을 발표한 모델은 없다.** 아래 수치는 모두 말소리 기준이다. 가창 성능이 공개된 모델은 Qwen3-ASR뿐이고, 그것도 중국어·영어 데이터에 한정된다.
- 찬양은 가사를 이미 아는 경우가 많으므로 **인식보다 강제 정렬(forced alignment)**이 맞다.
- 한국 개발자들 사이(X)에서는 로컬 **Qwen3-ASR-1.7B**로 옮기는 흐름이 있다. 다만 문장을 지어내는 환각이 있다는 경고도 있다. 콘서트 자막에 AI 인식을 쓴 사례는 "가사 인식이 너무 틀려서 가사 줄을 지웠다"는 부정적 결과였다.

## 로컬 (오픈 가중치)
| 모델 | 라이선스 | 한국어 CER (말소리) | 타임스탬프 | M3 24GB |
|---|---|---|---|---|
| **Whisper large-v3** | MIT | 독립 벤치(seastar105, 8개 세트 평균) **7.83%** | 구간 기본, 단어는 DTW 또는 wav2vec2 정렬 | mlx-whisper, whisper.cpp(Metal), faster-whisper |
| Whisper large-v3-turbo | MIT | 같은 벤치 9.36% | 위와 같음 | 더 가볍고 빠름 |
| **whisper-medium-komixv2** (seastar105, 한국어 튜닝) | 미확인 | 같은 벤치 **7.05%** (공개 모델 중 1위급), KsponSpeech 8.91/8.31% | Whisper와 같음 | medium급이라 가벼움 |
| **Qwen3-ASR-1.7B** | Apache-2.0 | 같은 벤치 9.78%. FLEURS 2.57(모델 카드) / 2.96(seastar) / 3.54(독립 Mac 측정) | ASR 자체는 없음. 별도 **Qwen3-ForcedAligner-0.6B**가 한국어 지원(평균 오차 37.2ms, 호출당 최대 5분) | MLX 8bit 약 2.5GB. M4 Max에서 2.5시간 음성을 3분 40초에 처리(X 사례) |
| Qwen3-ASR-0.6B | Apache-2.0 | 같은 벤치 17.29%, 콜센터 세트 59.62% | 위와 같음 | 가벼움 |
| SenseVoice-Small | FunASR 모델 라이선스(출처 표기 시 상업 가능하다는 유지관리자 답변) | 12.72% | 한국어 단어 타임스탬프 없음 | CPU로도 빠름 |
| Meta Omnilingual ASR | Apache-2.0 | 한국어 단독 수치 없음 | 단어 타임스탬프 없음 | 7B 8bit 약 6.6GB |
| Meta MMS | CC-BY-NC-4.0 | FLEURS WER 37.5%+ (Whisper v2 14.3%) | 프레임 정렬만(MMS_FA는 정렬기로 사용 가능) | 비상업·정확도 문제로 제외 |
| Moonshine tiny/base-ko | Community(상업 조건 확인 필요) | FLEURS 8.9 (tiny) | 없음 | 매우 작음(27M/62M) |
| NVIDIA Canary/Parakeet 오픈 가중치 | CC-BY | **한국어 미지원** | — | — |

- 주의: Zeroth로 튜닝한 모델의 CER 약 1.5%는 같은 도메인의 낭독 음성 수치라 대화나 노래에는 그대로 옮길 수 없다.
- 수치 출처가 서로 달라 직접 비교하면 안 된다. seastar105 벤치(2026.04)가 공개 모델을 같은 세트로 비교한 유일한 독립 자료다(30초 이하 발화, 노래 아님).

## API
| API | 한국어 근거 | 가격 | 타임스탬프 |
|---|---|---|---|
| **Groq whisper-large-v3-turbo** | 오픈 turbo와 같은 성능 | **$0.04/시간** (large-v3는 $0.111/시간). 무료 티어 있음(한도 변동) | Whisper API 형식. 단어 단위는 미확인 |
| OpenAI gpt-4o-mini-transcribe | 한국어 수치 없음 | $0.003/분 | ⚠️ 조사 간 충돌: Claude는 "whisper-1만 타임스탬프 제공", Grok은 "문서화됨" → 확인 필요 |
| OpenAI whisper-1 / gpt-4o-transcribe | gpt-4o-transcribe FLEURS CER 2.5(HiKE) | $0.006/분 | whisper-1은 구간·단어 제공 |
| **리턴제로(RTZR) sommers** | 자체 벤치 평균 CER **5.91%**(업체가 직접 측정) | **₩1,000/시간**(1,000시간까지), 이후 ₩500→₩300. 무료 600분 | 발화 시각 + `use_word_timestamp` |
| 네이버 CLOVA Speech | 같은 벤치 7.52% | 2026년 공식 가격 미확인(블로그 예시 ₩48/분 수준) | 구간·SRT. 단어 단위는 미확인 |
| Google Chirp 2/3 | Chirp 2는 ko-KR 문서화 | 표준 $0.016/분, 동적 배치 $0.003/분 | Chirp 2는 단어 시각 제공, **Chirp 3은 단어 타임스탬프 없음** |
| Deepgram Nova-3 | 한국어 지원(Nova-2는 RTZR 벤치 21.02%) | 사전녹음 $0.0043/분(단일 언어) | 단어 시각 제공 |
| ElevenLabs Scribe v2 | 한국어 지원, 수치 없음 | $0.22/시간 | 단어 단위 |
| AssemblyAI Universal-2 | 한국어 WER ">10~25%" 구간 | $0.15/시간 | 단어 단위(영어 최적) |

## 가창(노래) 관련 근거
- Qwen3-ASR-1.7B 가창 WER(중국어·영어만): M4Singer 5.98 (Whisper large-v3 13.58, gpt-4o-transcribe 16.77), Opencpop 3.08, 반주 포함 전곡 중국어 13.91 / 영어 14.60
- 한국어 가창 ASR 벤치마크나 K-pop 가사 벤치마크는 찾지 못함
- Whisper는 긴 기악 구간에서 환각이나 반복이 생기기 쉬움 → VAD 또는 보컬 분리 후 사용
- 보컬 분리(Demucs)가 Whisper 성능을 오히려 낮출 수 있다는 연구도 있음(이전 조사) → 원본과 보컬 stem을 비교해 봐야 함

## 추천
1. **로컬**: M3에서 MLX로 **Qwen3-ASR-1.7B**와 **Whisper large-v3 계열**(komixv2 또는 large-v3)을 **둘 다 시험**한다.
   - 말소리 독립 벤치에서는 Whisper 계열이 앞섰다.
   - 가창 근거와 한국어 정렬기는 Qwen이 유리하다.
   - Qwen은 환각 경고가 있으니, 두 모델이 일치하는 줄만 믿는 방식도 고려한다.
2. **가장 저렴한 API**: **Groq whisper-large-v3-turbo ($0.04/시간)**. 한국어 말소리 정확도가 최우선이면 리턴제로(₩1,000/시간, 업체 자체 벤치 기준 1위)
3. **가사 정렬(가사를 알 때)**:
   - 보컬 분리 후 **Qwen3-ForcedAligner-0.6B**로 가사를 강제 정렬한다(한국어 지원, Apache-2.0, 5분 단위로 나눠 호출). 가창에서의 정확도는 미검증이다.
   - 대안 정렬기: torchaudio MMS_FA(uroman 로마자화), WhisperX 한국어 wav2vec2(`kresnik/wav2vec2-large-xlsr-korean`)
   - 가장 단순한 방법: ASR로 대략 받아 적은 뒤, 구간별 가사 텍스트와 글자 편집거리로 퍼지 매칭해 구간 이름(Verse/Chorus)을 붙인다. 애매한 곳만 강제 정렬한다.
