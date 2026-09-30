# 실험 리소스 정리 (2026-09-28)

찬양 곡 오디오 분석(key·BPM·송폼·가사) 실험에 사용한 리소스 목록입니다.

## 1. 로컬 폴더 (저장소 안)
| 경로 | 크기 | 내용 | git |
|---|---|---|---|
| `.claude/documents/audio-analysis-research/` | 소 | key·BPM·송폼 측정 방법 조사 (Claude 3 + Grok 3 원문 + 한국어 종합) | 포함 |
| `.claude/documents/korean-stt-research/` | 소 | 한국어 STT 조사 (Claude + Grok 원문 + 종합) | 포함 |
| `.claude/loop/audio-analysis-test/` | 1.5GB | 시험 1: 3곡 key·BPM·송폼·전체 곡 STT. `README.md`(목표·절차), `LOG.md`(기록), `scripts/`, `kaggle/`, `results/` | 일부 포함 |
| ├ `.venv/` | 1.2GB | 로컬 Python 3.12 환경 (librosa, essentia, beat-this, demucs, madmom, SongFormer 의존성, `transformers<4.50`) | 제외 |
| ├ `audio/` | 92MB | 3곡 WAV + 합성 곡 | 제외 |
| └ `results/` | 129MB | Kaggle 결과(v3·v4·stt-v1·v2), `report.html`, `RESULTS.md` | 포함 |
| `.claude/loop/songform-crop-stt/` | 819MB | 시험 2: 10곡 송폼 → 구간 crop → STT + CER. `README.md`, `LOG.md`, `songs.json`, `scripts/` | 일부 포함 |
| ├ `audio/` | 285MB | 10곡 WAV | 제외 |
| ├ `refs/` | 3MB | 악보 이미지 14장, 정답 가사 10곡, 출처(`sources.json`) — **저작물** | 제외 |
| ├ `kaggle/` | 285MB | 커널 코드(포함) + 데이터셋 스테이징(`kaggle/dataset/`, 제외) | 일부 포함 |
| └ `results/` | 245MB | Kaggle 결과, `cer.json`, `report.html` | 포함 |

- 주의: 두 시험의 `results/`에는 Kaggle이 내려준 큰 파일(로그, 노트북 HTML 등)이 섞여 있어, 커밋 전에 필요한 것만 남길지 정해야 합니다.

## 2. 로컬 캐시 (저장소 밖, 이번 실험으로 생긴 것)
| 경로 | 크기 | 내용 |
|---|---|---|
| `~/.cache/huggingface/hub/models--ASLP-lab--SongFormer` | 5.1GB | SongFormer 가중치 + MuQ/MusicFM 코드 |
| `~/.cache/torch/hub/checkpoints/beat_this-final0.ckpt` | 77MB | Beat This! 가중치 |
| scratchpad (`/private/tmp/claude-501/.../scratchpad`) | 1.0GB | 초기 스모크 테스트용 venv·임시 파일. 세션용 임시 폴더 |

- 같은 캐시 폴더의 다른 모델(nllb, Qwen3-VL, whisper-mlx 등)은 이번 실험 이전부터 있던 것입니다.

## 3. Kaggle (계정 gunhe17, 모두 비공개)
| 종류 | 이름 | 용도 |
|---|---|---|
| 데이터셋 | `gunhe17/worship-audio-analysis-test` (88MB) | 시험 1 음원 3곡 + 스크립트 |
| 데이터셋 | `gunhe17/worship-songform-pool` (283MB) | 시험 2 음원 10곡 + `songs.json` |
| 커널 | `gunhe17/worship-audio-analysis-run` | 시험 1: SongFormer 420/180초 창, BPM·key (v1~v4) |
| 커널 | `gunhe17/worship-lyrics-stt` | 시험 1: 전체 곡 STT (v1·v2) |
| 커널 | `gunhe17/worship-songform-crop-stt` | 시험 2: 송폼 → crop → STT 3모델 |
| 커널 | `gunhe17/worship-songform-ghost613` | 시험 2: ghost613 재실행 |

- GPU 사용량: `kaggle quota`로 조회. 2026-09-30 기준 **5.31시간 사용 / 24.69시간 남음 / 30시간**, TPU 0 / 20시간 (2026-10-03 00:00 UTC 초기화). 장비: Tesla T4 16GB
- 인증: 저장소 루트 `.env`의 `KAGGLE_API_TOKEN` (git 제외). 명령마다 읽어 쓰고 출력하지 않음
- 데이터셋에 저작권 음원이 있으므로 **공개로 바꾸면 안 됨**

### Kaggle 무료 사용량 (2026-09-30 조사)
| 항목 | 한도 | 근거 |
|---|---|---|
| GPU (T4 ×2 또는 P100) | 주 약 30시간, 수요에 따라 변동("floating quota", 30시간보다 많을 때도 있음) | Kaggle 공지·포럼 |
| TPU | 주 20시간 | `kaggle quota` |
| CPU | 주간 한도 없음 (GPU 한도에 포함 안 됨) | 이 프로젝트의 CPU 커널 사용 경험 |
| 세션 1회 | CPU·GPU 최대 12시간, TPU 9시간 | 검색 요약 |
| 저장 공간 | `/kaggle/working` 20GB (커밋 시 자동 저장) | 검색 요약 |
| 동시 실행 | 배치(커밋) CPU 세션 최대 5개 ("Maximum batch CPU session count of 5 reached") | 포럼 |
| 초기화 | 주 단위. 이 계정은 2026-10-03 00:00 UTC 초기화 | `kaggle quota` |
| 인터넷 | 전화번호 인증 후 사용 가능 (이 계정은 인증 완료) | 이 프로젝트 경험 |
- Kaggle 공식 문서(docs/notebooks, docs/efficient-gpu-usage)는 스크립트로 그려지는 페이지라 이번에 본문을 직접 읽지 못함. 위 수치 중 "검색 요약"은 공식 본문으로 재확인하지 않은 값
- 이 프로젝트에서는 OCR·렌더링·채점을 CPU 커널로 돌려 GPU 한도를 거의 쓰지 않음. GPU를 쓴 작업: 음원 분석(SongFormer, Whisper 등), Qwen3-VL, 100장 행 분리(EasyOCR)

## 4. 아티팩트 (claude.ai, 비공개)
| 제목 | 링크 | 로컬 원본 |
|---|---|---|
| 찬양 오디오 분석 결과 | https://claude.ai/artifact/MHJazAZindSDrVPx3EGXmq | `loop/audio-analysis-test/results/report.html` |
| 송폼 구간별 가사 | https://claude.ai/artifact/Bub5BKKscVV6dZEe5Bgp8S | `loop/songform-crop-stt/results/report.html` |

## 5. 사용한 모델
| 모델 | 용도 | 실행 위치 | 라이선스 |
|---|---|---|---|
| Beat This! (final0) | BPM·beat·downbeat | 로컬 CPU/MPS, Kaggle T4 | MIT |
| SongFormer (+ MuQ, MusicFM) | 송폼 구간·라벨 | 로컬 MPS(180초 창), Kaggle T4 | 코드 CC-BY-4.0 / **MuQ 가중치 CC-BY-NC 4.0 (비상업)** |
| Essentia KeyExtractor (krumhansl, 36bin) | key | 로컬, Kaggle | **AGPL-3.0** |
| madmom CNNKeyRecognition | key | 로컬, Kaggle | 코드 BSD / **모델 CC BY-NC-SA** |
| Demucs htdemucs | 보컬·stem 분리 | 로컬 CPU, Kaggle T4 | MIT |
| Whisper large-v3 (faster-whisper) | STT (CER 최고) | Kaggle T4 | MIT |
| ghost613/whisper-large-v3-turbo-korean | STT | Kaggle T4 | 카드에 명시 없음 |
| Qwen3-ASR-1.7B (+ ForcedAligner-0.6B) | STT | Kaggle T4 | Apache-2.0 |
| librosa | 크로마·튜닝·OTI | 로컬, Kaggle | ISC |

## 6. 외부 도구·서비스
| 도구 | 용도 |
|---|---|
| Grok CLI (`grok -p`, X·웹 검색) | 조사, 곡 후보 수집, 무료 악보·가사 출처 검색 |
| Claude 리서치 에이전트 | 조사(웹) |
| `yt-dlp` + ffmpeg | YouTube 공식 영상에서 오디오 추출 (개인 시험용) |
| `kaggle` CLI 2.2.4 (`uv tool`) | 데이터셋·커널 업로드, 실행, 결과 다운로드 |
| Colab MCP (`colab-mcp`, 이 프로젝트 local scope) | 설정만 함. 실험에는 사용하지 않음 |
| Chrome headless | 아티팩트 화면 점검용 스크린샷 |

## 7. 음원과 악보 출처
- 음원 10곡: 각 팀 공식 YouTube 채널 (`loop/songform-crop-stt/songs.json`에 URL)
- 악보 8곡: 무료 공개 악보 (네이버 블로그, 티스토리, 팀 무료 배포본) / 가사 텍스트 2곡: ccm3, Bugs (`refs/sources.json`)
- 모두 개인 시험·평가용으로만 사용했고 아티팩트에는 수치만 게시

## 8. 정리할 때 참고 (실행하지 않음)
- 공간을 가장 많이 차지: SongFormer 캐시 5.1GB, `audio-analysis-test/.venv` 1.2GB, scratchpad 1.0GB(세션 종료 시 정리 대상)
- 실험을 이어갈 계획이면 음원(`audio/`)과 `refs/`는 유지해야 CER 재계산이 가능
