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

### 4. Kaggle 실행 (진행 중)
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
