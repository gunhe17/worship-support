# 진행 기록

## 2026-09-28

### 1. 폴더와 절차 분리 (완료)
- 이전 loop(`audio-analysis-test`)와 분리해 `songform-crop-stt/` 생성. 목표와 절차는 [README.md](README.md)
- 사용자 지시: 송폼 검토 절차는 사용자가 결과를 보고 제시함 → 이 시험은 **송폼 추출 → 여유 crop → 구간별 STT**까지만

### 2. 곡 수집 (완료) — `songs.json`
- 기존 3곡 + Grok(웹·X 검색) 후보 9곡 중 **팀이 겹치지 않게 7곡** 추가 → 10곡, 10팀
- `yt-dlp --print`로 채널, 제목, 길이 확인. 9곡 모두 각 팀의 공식 채널
- 예비 후보(미사용): 마커스워십 "은혜"(AXCuHNnHRRM), 어노인팅 "주와 같이 길 가는 것"(Z0ZFf1JkiMM)

| id | 팀 | 곡 | 종류 | 길이 |
|---|---|---|---|---|
| markers_love-of-god | 마커스워십 | 주님의 사랑 | live | 6:38 |
| anointing_rejoice | 어노인팅 | 주 안에서 기뻐해 | live | 5:49 |
| jus_return-to-lord | 제이어스 | 여호와께 돌아가자 | studio | 4:51 |
| welove_loving-you-more | 위러브 | 우리가 주를 더욱 사랑하고 | studio | 5:07 |
| isaiah61_god-so-loved | 아이자야씩스티원 | 하나님께서 세상을 사랑하사 | live | 4:47 |
| ywam_first-and-last | 예수전도단 | 처음과 나중 | live | 7:48 |
| fia_my-jesus | 피아워십 | 나의 예수님 | studio | 4:37 |
| levites_lord-of-my-heart | 레위지파(리바이츠) | 나의 예수 | studio | 6:40 |
| teamluke_built-together | 팀룩워십 | 함께 지어져 가네 | live | 5:51 |
| ongi_kingdom-and-glory | 옹기장이 | 주의 나라와 영광 이곳에 | live | 4:27 |

### 3. 음원 확보 (완료)
- 기존 3곡은 이전 loop에서 복사, 신규 7곡은 `yt-dlp -f bestaudio` → ffmpeg 44.1kHz mono WAV
- 문제: `while read` 루프 안에서 yt-dlp가 stdin을 읽어 일부 파일명의 첫 글자가 잘림 → 파일명 수정 후 10곡 모두 확인. 다음부터는 `yt-dlp ... < /dev/null`로 실행할 것

### 4. Kaggle 실행 (완료)
- 비공개 데이터셋 `gunhe17/worship-songform-pool` (10곡 WAV + songs.json)
- 비공개 커널 `gunhe17/worship-songform-crop-stt` (`kaggle/kernel/run.py`, T4)
  - A. SongFormer 180초 창 (`transformers<4.50`)
  - B. Demucs htdemucs 보컬 분리 + 구간 crop `[start−1.5초, end+1.5초]`, 16kHz mono (믹스 / 보컬)
  - C. 모든 crop에 STT: Whisper large-v3 (VAD 없음) · ghost613 (base turbo generation config 사용) · Qwen3-ASR-1.7B (정렬기 없이). qwen-asr 설치 뒤 새 프로세스에서 실행
- 결과: `results/kaggle-v1/out/<곡>.json` (구간, crop 범위, 구간별 STT), `timing.json`
- **Kaggle v1 완료** (16:47~17:21), 결과 `results/kaggle-v1/out/`
  - 10곡 모두 성공. 구간 수: 13~27개(총 207개), crop 414개(구간 × 입력 2종)
  - 시간(T4): SongFormer 곡당 15~35초, Demucs+crop 곡당 13~22초, STT 전체 Whisper 407.8초 · ghost613 54.1초 · Qwen 581.2초
  - **ghost613 전 구간 실패**: `ValueError: The generation config is outdated ... language argument`. 원인은 C단계에서 qwen-asr를 설치하면서 transformers가 올라간 것으로 보임. Whisper large-v3와 Qwen3-ASR은 전 구간 정상
- **새 아티팩트 게시**: https://claude.ai/artifact/Bub5BKKscVV6dZEe5Bgp8S (`scripts/build_report.py` + `scripts/report_template.html` → `results/report.html`). ghost613 오류도 그대로 표시
- **ghost613 재실행** (커널 `gunhe17/worship-songform-ghost613`, `kaggle/ghost-kernel/run.py`): Kaggle 기본 transformers를 그대로 사용하고(이전 STT v2에서 동작 확인), v1 커널 출력의 `segments.json`에서 crop 범위를 가져와 같은 구간으로 다시 자름 → `results/kaggle-ghost613/out/`. 끝나면 빌더가 v1의 ghost613 결과를 이것으로 덮어씀

### 5. Claude 검토 — 구간별 STT가 송폼 파악에 도움이 되는가 (사용자 요청)
- 도구: `scripts/review_probe.py` (`-v`로 곡별 상세). Whisper large-v3와 Qwen3-ASR의 **보컬 입력** 결과 사용 (ghost613은 재실행 대기)
- 지표 (207개 구간):
  - 신뢰 가능 구간(두 모델 일치도 ≥ 0.5, 환각·반복 없음, 8자 이상): **140개 (68%)**
  - 환각 문구가 나온 구간(믹스·보컬 합산): **Whisper 20개, Qwen 1개**. Whisper는 "한글자막 by 한효정", "감사합니다", "안녕하세요" 등을 **실제로 노래가 있는 구간에서도** 출력함 (예: 옹기장이 5개 구간)
  - 가사 반복 그룹 36개, 그중 **SongFormer 라벨이 섞인 그룹 15개**
  - 인접한 같은 라벨 구간 93쌍 (SongFormer가 한 구간을 13~16초 단위로 잘게 나눔)
- 관찰:
  1. **SongFormer 라벨 오류를 가사가 드러냄**: 마커스 17~19번(bridge, verse, verse)의 가사가 pre-chorus("나 얻었네 변함없는 그 사랑…")와 같음. 예수전도단 10번은 intro 라벨인데 chorus 가사("온 백성 다 외치네")
  2. **chorus가 앞·뒤 절반으로 나뉨**: 마커스 chorus가 "주님의 사랑 바람에 실리는…" 그룹(4·9·13·15·22)과 "주님의 은혜…내 맘 채우네" 그룹(14·21·23)으로 갈림. 인접 구간을 이어 붙이면 하나의 chorus가 됨
  3. **두 모델 일치도가 신뢰도 신호로 쓸 만함**: 일치도가 높은 구간의 텍스트는 실제 가사에 가까워 보이고, 낮은 구간은 환각이나 반주 구간이 많음 (정답 대조는 하지 않음)
  4. **멘트 구간도 잡힘**: 예수전도단 outro는 인도자의 말("큰 박수로 주님께…")이 두 모델에서 거의 같게 나옴 → 노래와 멘트를 구분하는 단서가 될 수 있음
  5. **padding ±1.5초의 부작용**: 앞 구간의 끝 가사가 다음 구간 앞에 섞임 (예: 마커스 4번 앞의 "없네 주님의 사랑")
  6. **약한 곡**: 옹기장이(빠른 곡, 라이브) 신뢰 구간 5/13, 예수전도단(라이브) 13/27에 반복 그룹 1개
- **ghost613 재실행 완료** (17:35~17:50): 414개 crop 모두 성공(오류 0), 923초(Demucs 포함). Kaggle 기본 transformers는 5.0.0이었고 `openai/whisper-large-v3-turbo`의 generation config를 빌려 쓰는 방식으로 동작함. v1이 실패한 원인은 transformers 버전 자체가 아니라, qwen-asr 설치로 바뀐 환경으로 보임(미확인)
  - 관찰: 일부 구간에서 반복 환각이 있음(예: 마커스 4번 "…안된다고 발언에 맞춰서는…" 반복)
- 아티팩트 갱신: ghost613 ERROR 칸을 재실행 결과로 교체

### 6. 모델 비교 — 정답 가사 없는 간접 지표 (사용자 질문: 가장 성능 좋은 모델)
- 도구: `scripts/model_probe.py` (414개 crop = 207개 구간 × 믹스·보컬)

| 모델 | 환각 문구 % | 반복 루프 % | 빈 출력 % | 다른 모델과 일치도 | 믹스·보컬 일관성 | 평균 글자 수 |
|---|---|---|---|---|---|---|
| whisper-large-v3 | 7.5 | 1.4 | 0.0 | 0.480 | 0.737 | 26.5 |
| whisper-turbo-ko-ghost613 | 0.0 | **30.9** | 0.0 | 0.324 | 0.454 | 51.6 |
| qwen3-asr-1.7b | **0.2** | 1.4 | 0.5 | 0.484 | 0.736 | 27.9 |

- 해석: Qwen3-ASR ≈ Whisper large-v3 > ghost613. Qwen과 Whisper는 일치도·일관성이 거의 같고, 차이는 Whisper의 환각 문구(7.5%)
- 한계: 일치도는 Whisper와 Qwen이 서로 비슷하면 둘 다 높게 나오는 순환 지표. 실제 정확도(CER)는 정답 가사가 있어야 측정 가능

### 7. 정답 가사 대비 CER (사용자 요청: 악보를 검색해 직접 이미지를 확인하고 작업)
- 악보 수집: Grok 웹 검색으로 **무료로 공개된** 악보 이미지만 찾음(유료 사이트 제외) → `refs/sources.json`. curl로 받아(`refs/sheets/`, git 제외) **Claude가 이미지를 직접 읽고** 구간 태그를 붙여 가사를 옮겨 적음 → `refs/lyrics/<id>.txt`
  - 악보 이미지로 작성 8곡: 마커스, 어노인팅(정성권/강명식 D키), 제이어스(제이어스 무료 배포 악보), 위러브, 아이자야(Scott Brenner 원곡 악보), 예수전도단(화요모임 무료 배포), 피아워십, 레위지파(공식 리드시트)
  - 텍스트 가사로 작성 2곡: 팀룩(악보가 영어 가사뿐 → ccm3 한국어 가사), 옹기장이(무료 악보 없음 → Bugs 가사). WebFetch는 가사 반환을 거부해서 curl로 받아 로컬에서 추출
  - 저작물이라 `refs/`는 git 제외, 아티팩트에는 올리지 않음
- 평가: `scripts/eval_cer.py` → `results/cer.json`
  - 공연 순서가 악보 순서와 다르고 후렴이 반복되므로, 각 crop 전사를 정답 가사의 **가장 잘 맞는 구간에 semi-global 정렬**(시작·끝 자유, 정답 가사는 끝→처음이 이어지도록 두 번 붙임)해 CER = 편집거리 / 매칭된 정답 길이
  - "보컬 crop" = 세 모델 중 하나라도 CER < 0.5인 crop만 평가(가사 없는 기악 crop 제외). 빈 출력은 CER 1.0, 반복 폭주는 3.0으로 상한
- 결과 (보컬 crop 기준)

| 모델 | 입력 | crop 수 | 평균 CER | 중앙값 CER |
|---|---|---|---|---|
| **whisper-large-v3** | 믹스 | 165 | **0.188** | **0.107** |
| whisper-large-v3 | 보컬 | 153 | 0.228 | 0.154 |
| qwen3-asr-1.7b | 믹스 | 165 | 0.333 | 0.242 |
| qwen3-asr-1.7b | 보컬 | 153 | 0.312 | 0.238 |
| whisper-turbo-ko-ghost613 | 믹스 | 165 | 0.953 | 0.875 |
| whisper-turbo-ko-ghost613 | 보컬 | 153 | 0.846 | 0.714 |

- 곡별 중앙값(보컬 입력): Whisper가 10곡 중 9곡에서 가장 낮음(위러브만 Qwen 0.240 < Whisper 0.246로 거의 같음)
- **해석**: 6번의 간접 지표(환각 문구 비율)로는 Qwen이 앞섰지만, 정답 대비로는 **Whisper large-v3가 가장 정확**. Qwen은 환각 문구는 거의 없지만 가사 자체를 덜 정확하게 받아 적음(예: "나 얻었네" → "나 없는 내", "멈출" → "억제할"). Whisper는 **보컬 분리보다 원곡 믹스에서 더 정확**
- 주의: 정답은 악보·가사 기준이라 실제 공연에서 가사를 바꿔 부른 부분(애드리브, 반복 변형)도 오류로 계산됨. 어노인팅 악보는 D키 편곡본이지만 가사는 같음
- 아티팩트 갱신(v3): 상단에 **정답 가사 대비 CER** 표(모델×입력, 중앙값 기준 정렬)와 곡별 중앙값 표를 추가하고, 각 전사 칸 옆에 crop별 CER 배지(<0.2 초록, <0.5 노랑, 그 이상 빨강, 가사 없는 crop은 표시 안 함)를 붙임. 정답 가사 원문은 페이지에 넣지 않음. `eval_cer.py`의 `crop_cers`를 빌더에서 가져다 씀

### 8. 가사로 part 판정이 가능한가 (사용자 질문: "가사를 보고 이 가사가 이 곡의 어떤 part인지 먼저 결정해야 한다. LLM이 할 수 있나?")
- 도구: `scripts/part_match.py`. 각 crop의 STT 텍스트를 정답 가사의 **태그된 구간마다** semi-global 정렬해 CER이 가장 낮은 구간을 part로 예측. **LLM 미사용, 텍스트 대조만**
  - 입력은 CER 최고 조합인 `whisper-large-v3` × 원곡 믹스, 임계값 CER < 0.5
  - 버그 수정: 구간 텍스트를 두 번 이어 붙여 정렬. crop 하나가 같은 구간을 두 번 반복하는 경우(아이자야 2:54 등) 단일 사본으로는 정렬이 깨져 CER 1.00이 나왔음 → 할당 145 → 155개로 증가
- 결과 (207 crop)
  - **part 할당 155개 (75%)**. 기악 25개를 빼면 **가사 있는 crop 182개 중 155개 = 85%**
  - margin(1순위와 다른 part 2순위의 CER 차)이 대부분 +0.6~+2.0으로 판정이 뚜렷함
  - SongFormer 라벨과 비교 가능한 146개 중 101개 일치(69%). **불일치 45개 중 29개는 가사 매칭 CER<0.2로 거의 확실 → SongFormer 라벨 오류로 보임**
    - 예: 아이자야 0:47·1:02·1:50·2:06 SF=chorus인데 가사는 Pre-Chorus (CER 0.03~0.07)
    - 예: 제이어스 3:11·3:26 SF=verse인데 가사는 Bridge (CER 0.00·0.14)
    - 예: 마커스 4:39·4:56 SF=verse인데 가사는 Pre-Chorus — 5번 항목의 수동 검토 결과와 일치
  - **Verse 1/2/3 번호까지 구분됨** (옹기장이, 팀룩, 예수전도단). SongFormer는 전부 "verse"로만 냄
  - 미할당 52개 = 기악 25개(정상) + 가사 구간 27개(chorus 12, verse 8, bridge 4, pre-chorus 3). 원인은 애드리브·인도자 멘트 혼입, 구간 경계 걸침
- **결론**: 악보(태그된 가사)가 있으면 part 판정은 **판단 문제가 아니라 대조 문제**이고 LLM 없이 동작함. LLM이 실제로 필요한 곳은 ① 악보 이미지 → 태그된 가사 텍스트 추출(이번엔 Claude가 이미지를 직접 읽어서 수행), ② 미할당 27개 같은 애드리브·즉흥 구간 처리, ③ 악보가 아예 없는 곡

### 9. 악보 이미지 인식(비전 모델) 조사와 시험
- 조사 2건: `lab/sheet-to-xml/survey-vision-ocr/sources/` (Claude 웹, Grok X·웹)
  - **전용 OMR(Audiveris, oemer, homr, Sheet Music Transformer)은 한국어 가사를 읽지 못함.** Audiveris 가사 OCR은 영어·라틴어·독일어·프랑스어용, oemer/homr은 가사 기능 자체가 없음
  - 근거로 삼을 만한 수치: MusiXQA에서 GPT-4o가 제목·템포·박자표·**인쇄된 코드 이름** 읽기는 68.9%, 음표 전사는 4.0%. 우리 목표(가사+코드+key+tempo, 음표 불필요)는 68.9% 쪽
  - 한국어 OCR 실측: Qwen2.5-VL-72B 95.0 · Gemini 2.0 Flash 93.5 · GPT-4o 91.5 · Claude 3.5 Sonnet 76.5 (KOFFVQA) / PaddleOCR-VL 편집거리 0.052(오픈 OCR 최고), MinerU 0.917(한글 불가)
  - **한국어 악보에 대한 공개 수치는 없음** → 직접 측정 필요
  - 설계 함정: 음절 하이픈, 코드-가사 공간 정렬, 반복 기호 펼치기, A4 통째 입력 시 축소로 한글 뭉개짐(오선 단위 crop 권장)
- 로컬 시험(M3, mlx-vlm, Qwen3-VL-4B-8bit): 13장 중 6장 처리 후 **사용자 요청으로 중단하고 Kaggle로 이전**(로컬 리소스를 비워야 함). 참고로 4B가 1장당 약 47초, JSON 구조는 냈으나 "주**남**의 사랑", "**굶**이쳐" 같은 오탈자와 구간명 대신 마디 번호를 내는 문제가 있었음
- **Kaggle 시험**: 비공개 데이터셋 `gunhe17/worship-sheet-images`(악보 14장), 비공개 커널 `gunhe17/worship-sheet-vlm` (`kaggle/vlm-kernel/run.py`, T4)
  - Qwen3-VL-4B-Instruct (fp16) · Qwen3-VL-8B-Instruct (4bit) · PaddleOCR-VL — 각각 별도 프로세스로 실행해 한 모델 실패가 나머지를 막지 않게 함
  - 채점: `scripts/sheet_vlm.py`와 같은 방식으로 추출 가사를 정답 가사(`refs/lyrics/`)와 CER 비교
- **Kaggle 커널 실패 3회 → 4회차 성공** (`gunhe17/worship-sheet-vlm`)
  1. 데이터셋 경로: `--dir-mode zip` 업로드 시 `sheets/` 하위 폴더가 사라지고 이미지가 최상위에 올라감 → 확장자로 탐색하도록 수정
  2. Qwen 4B CUDA OOM(2479×3508 악보에서 8.92GB 요구) → `max_pixels=2048*28*28`, 이미지별 try/except, `empty_cache()` 추가
  3. `bitsandbytes`, `paddlex[ocr]` 미설치 → 설치 추가
- **결과 (Qwen3-VL-4B-Instruct, T4, 장당 평균 45초, JSON 파싱 실패 0장)** — 한국어 악보 CER은 공개된 적 없는 수치

| 곡 | 해상도 | CER |
|---|---|---|
| 마커스 | 966×1365 | **0.054** |
| 피아워십 | 2479×3508 | **0.060** |
| 예수전도단 | 1447×2048 | 0.295 |
| 레위지파 | 724×1024 | 0.689 |
| 어노인팅 | 966×1136 | 0.827 |
| 아이자야 | 966×1365 | 1.023 |
| 위러브 | 966×1366 | 1.155 |
| 제이어스 | 795×1123 | **1.797** |
| **평균** | | **0.737** |

- 관찰
  - **구간 태그 추출은 잘 됨**: 위러브에서 악보 표기 그대로 `ITR, V, P, C, ITL1, ITL2, B, C*, bis.`를 냈고, 어노인팅은 `D.S. al Fine`, `Fine`까지 읽음. 반면 마커스처럼 구간 표기가 없는 악보는 마디 번호(1~7)를 냄
  - **메타데이터도 잘 읽음**: 제목·key·박자·템포 대체로 정확 (제이어스 Eb/4:4/69, 위러브 D/4:4/140)
  - **실패는 한글 문자 정확도**: "주**남**의"(주님의), "나 **연었**네"(나 얻었네), "**우었**보다 **드림**게"(무엇보다 뜨겁게), "**둘아 셋지만**"(돌아섰지만)
  - **제이어스(CER 1.797)는 같은 구간 텍스트를 Verse와 Chorus에 그대로 복제**해 출력 → 중복 환각
  - 해상도와 CER의 상관이 뚜렷하지 않음(966×1365인 마커스 0.054 vs 아이자야 1.023). 원본 스캔 품질·글자 크기가 더 큰 변수로 보임
- **미완**: Qwen3-VL-8B는 4bit로도 T4에서 OOM, PaddleOCR-VL은 paddle 버전 충돌(`AnalysisConfig.set_optimization_level` 없음)

### 10. 악보 crop 도구와 MusicXML(OMR) 시험
**(1) 오선/마디 crop — `scripts/staff_crop.py`** (OpenCV만, CPU 1초)
- 가로 morphology로 오선 5줄을 찾고, 코드 행 + 오선 + 가사 행을 한 덩어리(band)로 잘라냄. **오선 단위 crop은 정확** (마커스 7줄, 제이어스 10줄, 레위지파 6줄, 예수전도단 4줄)
- 마디선은 오선을 지운 뒤 "세로로 오선 높이의 90% 이상 연속인 열"로 판정(음표 기둥은 최대 87.5%라 구분됨). 오선 제거 시 마디선도 끊겨서 세로 방향 closing으로 복원
- **마디 단위는 아직 과검출**: 잘 되는 줄은 `x=[69,83,291,488,722,896]`로 4~5마디를 정확히 잡지만, 조표의 ♯와 반복 기호를 마디선으로 오인하는 줄이 있음

**(2) Audiveris 5.11.0 → MusicXML** (Kaggle CPU 커널 `gunhe17/worship-sheet-omr`)
- 실패 2회: ① `.deb`가 `audiveris`를 PATH에 넣지 않음 → `/opt/audiveris/bin/Audiveris`를 직접 탐색 ② Tesseract legacy 모드에서 한국어 실패(`Could not initialize TessBaseAPI languages: kor+eng in legacy mode` → `No OCR'd lines`). Ubuntu의 `tesseract-ocr-kor`는 LSTM 전용이라 legacy 모드 불가 → `tesseract-ocr/tessdata` 저장소의 legacy 포함 파일로 교체
- 전처리: 1600px 미만 악보는 2배 확대(Audiveris는 300 DPI 스캔 전제)
- **가사 없이도 결과가 좋음 (2차 실행 기준)**: 15장 모두 .mxl 생성, 음표 101~322개 전사, 마디·반복(`<repeat>`)·엔딩(`<ending>`) 검출
  - **조표 8곡 전부 정확**: 마커스 fifths=4(E), 제이어스 −4(Ab), 예수전도단 −2(Bb), 어노인팅 2(D), 레위지파 2(D), 피아워십 1(G), 위러브 4(E), 팀룩 −1(F). 박자도 모두 4/4
  - 이는 오디오 기반 key 검출(관계조·5도 혼동이 있었음)보다 신뢰도가 높음
- **역할 분담이 분명해짐**: 구조(마디·반복·엔딩)와 key·박자는 **OMR**, 한국어 가사와 구간 이름은 **비전 LLM**

### 11. Audiveris 한글 가사 CER (3차 실행: legacy tessdata 교체 후)
- **한글 가사 추출 자체는 성공**: 15장 중 12장에서 `<lyric>` 텍스트에 한글 발견 (1·2차는 0장)
- **정확도는 Qwen3-VL-4B(평균 CER 0.737)보다 크게 낮음**

| 곡 | CER | 추출 글자수 / 정답 글자수 |
|---|---|---|
| 어노인팅 | 0.581 | 41 / 139 |
| 피아워십 | 2.160 | 76 / 134 |
| 아이자야 | 0.789 | 33 / 175 |
| 제이어스 | 0.808 | 26 / 118 |
| 레위지파 | 1.409 | 235 / 204 |
| 마커스 | 1.080 | 43 / 111 |
| 위러브 | 0.720 | 195 / 201 |
| 예수전도단 | 2.737 | 120 / 147 |
| **평균** | **1.286** | |

- 원인으로 보이는 것: 대부분 곡에서 **추출 글자수가 정답의 20~40%뿐**(어노인팅 41/139, 마커스 43/111, 제이어스 26/118) → Audiveris가 가사 대부분을 아예 놓침. 음표당 음절 하나씩 붙이는 구조라 하이픈으로 이어진 가사, 여러 절이 겹쳐 쓰인 줄(1절/2절)에서 특히 약한 것으로 추정(레위지파·위러브만 글자수가 비슷한데도 CER이 높아 오탈자 자체도 많음)
- **결론 확정**: 조사에서 예측한 대로 **OMR은 구조(마디·반복·조표·박자)에 쓰고, 가사는 비전 LLM(Qwen3-VL)에 맡기는 역할 분담이 맞다.** Audiveris 가사는 보조 신호로도 쓰기엔 손실이 큼
