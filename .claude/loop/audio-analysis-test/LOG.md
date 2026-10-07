# 진행 기록

## 2026-09-28

### 1. 환경 (완료)
- 머신: Apple M3, 8코어, RAM 24GB, ffmpeg 있음
- `uv venv -p 3.12` 후 설치: librosa ✅, essentia ✅ (macOS arm64 wheel), beat-this ✅, demucs ✅, madmom(git) ✅
- torch 2.14.0, MPS 사용 가능

### 2. 스모크 테스트 (완료) — `scripts/smoke.py`
합성 곡: 60초, 72 BPM, I–V–vi–IV, 0~40초 G major → 40~60초 Ab major, 킥 드럼

| 모델 | 결과 | CPU 시간 |
|---|---|---|
| Essentia KeyExtractor (krumhansl, 36bin) 구간 A/B | G major / Ab major ✅ | 0.1초 |
| madmom CNN key 구간 A/B | G major / Ab major ✅ | 2.7초 / 0.8초 |
| librosa tempo | 71.8 BPM ✅ | 16.1초 (첫 호출 JIT 포함) |
| Beat This! final0 (CPU, DBN 없음) | 71.4 BPM, 비트 73개, downbeat 19개 ✅ | 1.3초 (+ 가중치 77MB 첫 다운로드) |

결론: key·BPM 후보 모델은 **GPU 없이 CPU로 충분히 빠름**.

### 3. 테스트 폴더 전용 환경 (완료)
- `.claude/loop/audio-analysis-test/.venv` (git 제외), 설치 목록은 `requirements.lock.txt`

### 4. SongFormer 로컬 실행 (완료) — `scripts/songformer_run.py <audio> [cpu|mps]`
- HF `AutoModel.from_pretrained("ASLP-lab/SongFormer", trust_remote_code=True)`, 가중치 약 2.7GB
- 추가 의존성: muq, msaf, ema_pytorch, loguru, einops, omegaconf, x_transformers, torchaudio
- ⚠️ transformers 5.x는 모델을 meta device로 먼저 생성해서 MuQ 초기화가 실패함 → **`transformers<4.50`(4.49.0)으로 고정**하면 동작
- 합성 곡 60초 기준: **CPU 31.2초**(최대 RAM 약 6.3GB), **MPS 10.8초** (`PYTORCH_ENABLE_MPS_FALLBACK=1`)
- 라벨(verse/inst)은 합성 곡이라 의미 없음. 동작 여부만 확인
- ⚠️ **라이선스**: SongFormer 코드와 가중치는 CC-BY-4.0, MusicFM은 MIT/Apache-2.0이지만 **MuQ 가중치가 CC-BY-NC 4.0**이라 SongFormer 전체를 상업적으로 쓸 수 없음. 시험용으로만 사용
- 대안: HF Space(https://huggingface.co/spaces/ASLP-lab/SongFormer)에서 설치 없이 실행 가능

### 5. 통합 스크립트 (완료) — `scripts/analyze.py <audio> [--stems] [--device mps|cpu]`
- 순서: Beat This!(BPM, downbeat, 마디 박 수) → SongFormer 구간 → 구간별 key(Essentia krumhansl/36bin + madmom CNN) → 첫 chorus 대비 이후 chorus OTI
- `--stems`: htdemucs로 bass+other만 남겨 key 계산 (demucs는 CPU로 실행)
- 합성 곡 결과 (`results/synth.stems.json`):
  - BPM 71.4 ✅ (정답 72)
  - 구간 1·2 G major ✅✅ (두 모델 일치), 구간 4 Essentia Ab major ✅ / CNN F minor (관계조 혼동)
  - 구간 3(29.9~46.6초)은 **전조 지점(40초)을 가로지르는 구간**이라 key가 섞여 C minor / G major로 나옴
  - → **발견 1: 구간 경계와 전조 지점이 어긋나면 구간별 key가 흐려진다.** 구간 안에서 추가로 key 변화점을 찾거나, 윈도우 단위 key를 보완해야 함
- 소요 시간(MPS, 60초 곡): Beat This! 5.2초, SongFormer 16.6초(로드 포함), demucs 34.0초(CPU), key 20.7초(madmom 로드 포함)

### 6. 곡 선정 (완료) — 근거: `results/song-selection-grok.md`
X 검색에서는 이 곡들의 key·BPM 게시물이 나오지 않아, 정답은 코드 악보·분석 사이트·영상 댓글에서 가져왔다.

| 파일 | 팀 / 곡 / 영상 | 시험 포인트 | 정답 |
|---|---|---|---|
| `markers_love-of-god.wav` (6:38) | 마커스워십 / 주님의 사랑 / youtu.be/2omkAfYtcsE (2020 목요예배) | **전조** | E major → **F major (약 3:10, 마지막 후렴 key up)**. BPM 약 138~140 (다른 버전 기준, 이 영상은 미검증). 구간: Intro–V1(0:13)–PC(0:39)–C(0:53)–V2(1:33)–PC(2:00)–C(2:13)–PC(2:41)–C↑(3:10)–이후 미확인 |
| `anointing_rejoice.wav` (5:49) | 어노인팅 / 주 안에서 기뻐해 / youtu.be/oHgvIjvzb1o (Topic 채널, 예배캠프 2014) | **빠른 템포** | E major, **141 BPM**, 4/4, 전조 없음 (SongBPM, 반주 트랙 E/140) |
| `jus_return-to-lord.wav` (4:51) | 제이어스 / 여호와께 돌아가자 / youtu.be/kdFH0iSBU9I (앨범 가사 영상) | **관계조 + 반/두 배 템포** | 원키 악보는 **F minor**, Tunebat은 **Ab major**(관계조). BPM **69 (4분음표 느낌) / 138 (Tunebat)**. 4/4. 원곡 전조 미확인. 구간(라이브 기준): Intro–V–Pre–C–V–C–B–C |

- 어노인팅은 Grok의 첫 후보(그 사랑이 내려와, 11분, 정답 대부분 미검증) 대신 정답 근거가 있는 곡으로 바꿨다.

### 7. 음원 확보 (완료)
- `yt-dlp -f bestaudio` → ffmpeg 44.1kHz mono WAV, `audio/`에 저장 (git 제외, 개인 시험용)
- 제이어스 라이브 영상(NYiH9ftHjWo)은 HTTP 403 → 같은 채널의 앨범 영상(kdFH0iSBU9I)으로 대체

### 8. 측정 (완료 — Kaggle로 이전)
- 곡마다 `analyze.py`를 전체 믹스와 `--stems`(bass+other)로 2회 실행 → `results/<곡>.json`, `results/<곡>.stems.json`

#### 8-1. 문제: SongFormer 메모리 폭주 (해결)
- 첫 실행(MPS, 6.6분 곡)에서 9분 넘게 멈춤 → **스왑 22GB 사용**. 원인은 메모리 부족. 직접 중단함(exit 144)
- CPU로 재시도: 프로세스 메모리 **13GB**, 10분 넘게 스왑 상태(CPU 사용률 6%) → 중단
- 참고: 다른 가상화 프로세스(com.apple.Virtualization, 아마 Docker)가 약 8GB를 점유 중
- 원인: SongFormer가 **420초 창 전체에 MuQ-large를 full self-attention으로 적용**함(약 10,500 프레임, 층마다 수 GB). MuQ의 flash 경로(`is_flash`)는 CUDA 전용이라 CPU/MPS에서 쓸 수 없음
- HF Space(ASLP-lab/SongFormer)는 CONFIG_ERROR 상태라 사용 불가
- **해결**: `m.config.win_size = hop_size = 180`으로 창을 줄임 (`songformer_run.py <audio> mps 180`). 420초보다 짧은 곡은 원래도 짧은 창으로 처리되므로 학습 조건을 벗어나지 않음. 대신 180초 이상의 문맥은 잃음
  - 결과: 6.6분 곡 **MPS 61.6초, 최대 RSS 약 1GB** ✅
- `analyze.py`에 `--segments <json>` 옵션 추가: SongFormer를 따로 돌린 결과를 재사용
- **발견 2: 24GB 맥에서 SongFormer 기본 설정은 6분 넘는 곡을 처리할 수 없다. 창을 줄이거나 CUDA GPU가 필요하다.**

#### 8-2. 로컬 실행 중단 → Kaggle로 이전 (사용자 요청)
- 사용자가 로컬 리소스를 다른 작업에 써야 해서 **로컬 분석 중단** (exit 144, 의도적 중단)
- 보존된 결과: 3곡 구간(`*.segments.json`, SongFormer 180초 창, MPS) + 마커스 전체 믹스 분석(`markers_love-of-god.json`)
- 남은 작업(나머지 BPM·key 측정, stems 비교, 420초 기본 창 비교)은 **Kaggle GPU(T4, 무료 주 30시간)**에서 진행
- 대안 조사: Kaggle(주 30h GPU) · Lightning AI(월 80h GPU, SSH) · Modal($30/월 크레딧) · SageMaker Studio Lab(2026.07.30 종료). Kaggle은 CLI로 커널 업로드·실행·결과 다운로드를 자동화할 수 있어 선택
- 이 세션에는 브라우저 제어 도구가 없음 → 브라우저가 필요한 단계(로그인, 전화번호 인증, API 토큰)는 모두 인증 단계라 사용자에게 요청하고, 나머지는 `kaggle` CLI(2.2.4)로 진행

### 9. Kaggle 실행 (완료)
- 인증: 사용자가 `.env`의 `KAGGLE_API_TOKEN`으로 제공(git 제외). 명령마다 `.env`에서 읽어 환경변수로만 쓰고 출력하지 않음. 계정 gunhe17, GPU 할당량 주 30시간
- **비공개 데이터셋** `gunhe17/worship-audio-analysis-test`: 3곡 WAV + `analyze.py`, `songformer_run.py` (스테이징 폴더 `kaggle/dataset/`는 git 제외)
- **비공개 커널** `gunhe17/worship-audio-analysis-run` (`kaggle/kernel/run.py`, GPU + 인터넷 사용)
  - 곡마다 SongFormer를 **420초(기본)와 180초 창으로 각각 실행**해 비교 → `results/<곡>.segments.w420|w180.json`
  - 420초 구간 결과로 `analyze.py`를 전체 믹스와 `--stems`로 실행 (cuda)
- 결과 다운로드: `kaggle kernels output gunhe17/worship-audio-analysis-run -p results/kaggle`
- **커널 v1 실패**: ① GPU가 할당되지 않음(`nvidia-smi: not found`, 메타데이터의 `enable_gpu`만으로는 부족) ② pip 설치 실패(`subprocess-exited-with-error`, madmom git 빌드로 추정) → 모든 분석이 실행되지 않음. 결과 파일은 빈 상태로 `results/kaggle/`에 남음
- **커널 v2**: `kaggle kernels push --accelerator NvidiaTeslaT4`, cython·numpy 먼저 설치 후 madmom은 `--no-build-isolation`으로 설치, pip 로그는 `results/pip.log`에 저장, import 점검 단계 추가, `/usr/bin/time` 제거
- 사용자 요청: **채점하지 않고 원시 결과만 보여주기** (채점은 사용자가 직접)
- **커널 v2 실패** (15:05~15:12): GPU가 할당되지 않음(`nvidia-smi` 없음, 할당량 사용 0.00h) + **인터넷 차단**(DNS `Temporary failure in name resolution`) → pip, madmom git clone, HF 가중치 다운로드가 모두 실패해 분석이 전혀 실행되지 않음
- 추정 원인: 계정 **전화번호 미인증**. Kaggle은 노트북에서 GPU와 인터넷을 쓰려면 전화번호 인증이 필요함 → 사용자에게 인증 요청 (https://www.kaggle.com/settings)
- 사용자 확인: Kaggle 설정의 Phone verification이 **Verified** 상태. 서버에 등록된 커널 메타데이터도 정상(`enable_gpu: true`, `enable_internet: true`, `machine_shape: NvidiaTeslaT4`)
- **커널 v3**: 시작할 때 GPU(`nvidia-smi`)와 인터넷(pypi.org 접속)을 확인하고, 둘 중 하나라도 없으면 바로 종료(`PRECHECK`)하도록 추가
- **커널 v3 완료** (15:17~15:25): `PRECHECK gpu=True internet=True`, Tesla T4 15GB. 이전 실패는 전화번호 인증이 반영되기 전이었던 것으로 보임
  - SongFormer 420초 창: 제이어스(4:51)는 성공(21.2초). **마커스(6:38)와 어노인팅(5:49)은 CUDA OOM**(5.9GB 추가 할당 실패, T4 14.56GB) → 이 두 곡은 BPM·key 분석도 실패
  - 180초 창: 3곡 모두 성공
  - 결과는 `results/kaggle-v3/`에 보관
- **커널 v4 완료** (15:26~15:36): 마커스와 어노인팅만 180초 창 구간으로 BPM·key 분석 재실행 → `results/kaggle-v4/`
- **원시 결과 표**: `results/RESULTS.md` (`scripts/raw_table.py`로 생성). 채점하지 않음(사용자가 직접 채점)

### 10. 결과 리포트 (완료)
- `scripts/build_report.py` + `scripts/report_template.html` → `results/report.html` (원시 결과, 채점 없음)
- 아티팩트: https://claude.ai/artifact/MHJazAZindSDrVPx3EGXmq (비공개)
- 구성: 실행 대상 요약표 → 곡별로 같은 형식(참고 정보 대 모델 출력 대조 + 타임라인 + 원시 값 표) → SongFormer 창 크기 비교 → 실행 시간

### 11. 가사 추출(STT) 시험 (완료)
- 근거 조사: `.claude/documents/korean-stt-research/`
- 목적: 가사를 모른다고 가정하고 노래에서 한국어 가사를 받아 적기(전사)
- 설계: 3곡 × 모델 3개 × 입력 2종 = 18회 전사
  - 모델: Whisper large-v3 (faster-whisper fp16, VAD 사용, `condition_on_previous_text=False`) · `ghost613/whisper-large-v3-turbo-korean` (transformers, 30초 청크) · Qwen3-ASR-1.7B + Qwen3-ForcedAligner-0.6B (fp16 — T4는 bf16 미지원, 120초 청크 — 정렬기 최대 5분)
  - 입력: 원본 믹스(16kHz mono) / Demucs htdemucs 보컬 stem
  - `whisper-medium-komixv2`는 HF에서 401(비공개)이라 제외
- 커널: 비공개 `gunhe17/worship-lyrics-stt` (`kaggle/stt-kernel/run.py`), 데이터셋은 기존 것 재사용
- 결과: `results/stt-v1/stt/<곡>.<모델>.<입력>.json` (전체 텍스트, 구간별 시작·끝·텍스트, Qwen은 단어 타임스탬프 포함)
- **STT v1 완료** (16:04~16:15), 결과 `results/stt-v1/stt/`
  - Whisper large-v3 + VAD: 믹스 입력에서 VAD가 노래 구간을 거의 다 잘라 3곡 모두 **1개 구간("감사합니다." 등)만 출력**. 보컬 stem 입력에서는 11~37개 구간
  - ghost613: 18회 중 6회 모두 실패 — `ValueError: generation config ... no_timestamps_token_id` (체크포인트의 generation config에 타임스탬프 설정이 없음)
  - Qwen3-ASR-1.7B: 6회 모두 전사 성공. **ForcedAligner 단어 타임스탬프는 대부분 0**(곡·입력별로 전체 단어 중 11~54개만 0이 아닌 구간). 파싱은 정상이었고(`ForcedAlignResult.items[].start_time/end_time`), 정렬기 출력 자체가 0임
- **STT v2**: ghost613은 `openai/whisper-large-v3-turbo`의 generation config를 빌려 재실행하고, Whisper large-v3는 **VAD 없이**(`whisper-large-v3-novad`) 두 입력 모두 추가 실행 → `results/stt-v2/stt/`
- **STT v2 완료** (16:18~16:28), 결과 `results/stt-v2/stt/`
  - whisper-large-v3-novad: 6회 모두 성공 (27~62개 구간, 곡당 9~18초)
  - ghost613: 6회 모두 전사됨. 다만 **타임스탬프 없이 구간 1개**로만 나옴(곡당 66~132초)
- 아티팩트에 가사 전사 추가: 모델 4개(Whisper large-v3 VAD / no-VAD, ghost613, Qwen3-ASR) × 입력 2종, 표와 타임라인
