# 진행 기록

## 2026-10-07 ~ 08

### 1. v1 실행 (커널 `gunhe17/worship-key-sweep`, T4) → `results/v1/`
- selftest 통과. 대상: 합성 30 + 정답 3 + 500곡
- 1단계 Demucs 533곡 **10,027초(2.8시간)**, 2단계는 곡당 프로세스당 약 5분으로 예상보다 몇 배 느림
- 11시간 시점에 남은 곡 건너뛰기 → 처리 중이던 곡을 끝내는 사이 Kaggle 실행 제한으로 **집계 전에 종료**(CANCEL_ACKNOWLEDGED)
- 남은 곡별 결과 391개: 합성 29, 정답 3, 500곡 중 359. 곡당 방법 45개 동작
- 실패한 방법: Essentia 프로파일 faraldo·pentatonic(이 버전 미지원, 전 곡), weichai 일부(13곡)

### 2. 집계 (커널 `gunhe17/worship-key-sweep-summary`, CPU) → `results/v1-summary/out/summary.json`
- 끊긴 커널의 출력은 다른 커널 입력으로 붙지 않음(입력 폴더 비어 있음) → 곡별 JSON 391개를 비공개 데이터셋 `gunhe17/worship-key-sweep-v1-songs`로 올려 집계
- **곡 key** (정답 있는 32곡 = 합성 29 + 3곡, MIREX 가중):

| 방법 | MIREX | 정확 | 주된 오류 |
|---|---|---|---|
| bl_ess (사용자 코드, Essentia) | **0.728** | 0.625 | 관계조 11 |
| bl_lib (사용자 코드, librosa) | 0.722 | 0.594 | 관계조 12 |
| chord_key (madmom 코드 → key) | 0.691 | 0.562 | 관계조 12 |
| pipe_stem (key-pipeline, stem) | 0.688 | 0.594 | 관계조 10 |
| tpl_kk_stem / tpl_kk_mix | 0.669 / 0.666 | | 5도·관계조 |
| pipe_mix | 0.631 | 0.531 | |
| cnn_mix (madmom CNN) | 0.603 | 0.438 | 5도 위 7 |
| Essentia 프로파일 최고(diatonic) | 0.572 | 0.50 | |

  - 오류 대부분이 **관계조**. 합성 단조 곡의 진행(i–VI–III–VII)이 나란한조 장조와 같은 화음이라 합성 세트 자체가 모호함 → 합성 단조는 V(장3화음)를 넣어 다시 만들 필요
- **전조 검출** (합성 29곡, ±10초·도착 key 일치):

| 방법 | 정밀도 | 재현율 |
|---|---|---|
| pipe_mix | **0.714** | 0.172 |
| pipe_stem | 0.50 | 0.138 |
| esswin_temperley | 0.157 | **0.483** |
| esswin_edma | 0.087 | 0.483 |
| cnnwin_mix | 0.136 | 0.103 |
| bl_ess / bl_lib | 0 / – | **0** |

  - 사용자 코드(bl_*)는 합성 곡의 전조를 하나도 못 잡음 → 전역 사전확률이 끝부분 20초짜리 key를 지우는 것으로 보임(예상했던 약점)
  - key-pipeline은 잡은 것은 대체로 맞지만 대부분 놓침(8마디 합치기), 창별 Essentia는 많이 잡지만 오검출이 많음
- **500곡(359곡) 방법 간 곡 key 일치도**: bl_ess–cnn_mix 97.8%, chord_key–cnn_mix 93%, bl_ess–chord_key 92.5%, bl_lib–pipe_mix 91.4%. Essentia bgate는 다른 방법과 62–72%로 가장 동떨어짐
- **key up 후보**: pipe·bl 4개 중 2개 이상이 같은 장단조 +1/+2 상승을 낸 곡 74곡 (4개 모두 23곡, 3개 15곡)

### 3. 결과 페이지
- 곡별 조회: https://claude.ai/artifact/6hZfHMqwqah2DuWmSxQimz (비공개), 같은 내용 `results/reports/key-compare-v1.html`
- 곡을 고르면 ① 시간에 따른 key(구간·창 단위 방법 8개 + 정답, 색은 다수 의견 key와의 관계) ② 방법 45개의 곡 key 표(계열·라이선스별, 정답 있는 곡은 정답 대비)
- 다수 의견 = bl_ess, bl_lib, chord_key, pipe_stem, pipe_mix, cnn_mix, tpl_kk_mix 곡 key의 최빈값
- 모델별 행 × 영역별 그래프: https://claude.ai/artifact/DAjZZs9GAS7heQ2WZJ6iCU (비공개), `results/reports/key-models-by-area-v1.html` (①곡 key 점수 ②오류 종류 ③전조 검출 ④다수 의견 일치 ⑤장·단조 비율, ④⑤는 페이지에서 곡별 데이터로 계산)
- 곡별 조회 페이지를 편집기 트랙 형태로 변경(v2): 정답·코드열(madmom)·방법 45개를 시간축 트랙으로, Ctrl/⌘+휠·핀치·슬라이더로 가로 확대(최대 200px/초), 드래그·가로 스크롤로 이동, 시간 눈금·트랙 이름 고정, 세로 재생선. `results/reports/key-compare-v1.html` 갱신
