# BPM 전용 파이프라인 (bpm-pipeline)

이전 실험: [_common/experiments/audio-analysis-test](../../../_common/experiments/audio-analysis-test/) (key·BPM·송폼을 한 스크립트로 측정)

## 목표
곡 오디오 → **BPM · 박자 · 마디**. 템포가 안정적이면 BPM 하나, **흔들리면 범위**로 응답한다(사용자 결정, 2026-10-07).

## 절차 ([kaggle/bpm.py](kaggle/bpm.py), 조사 [survey.md](../../survey.md) 1.7)
1. Beat This!(MIT, DBN 없이) → beats, downbeats
2. 지역 템포: 8 beat 창 / 4 beat 간격, 간격 중앙값
3. 반·두 배 통일: 곡 기준 T(지역 템포 중앙값)에 모든 지역 템포를 같은 옥타브로 접음. (`--feel ballad|mid|up` 옵션은 있지만 결정 2에 따라 지금은 쓰지 않음)
4. 안정 판정: p90/p10 ≤ 1.08 (±4%) → `bpm`, 아니면 `bpm=null`, `bpm_range=[p10, p90]`
5. 구간별 템포: 평활화한 곡선이 구간 중앙값에서 ±2% 넘게 16 beat 연속 벗어나면 새 구간, 경계는 주변 beat 간격으로 다듬음
6. 마디: downbeat ~ 다음 downbeat. 마디당 beat 수 최빈값 = 박자, 다른 마디 수(`odd_bars`), 못갖춘마디 beat 수
- 출력: `bpm`, `bpm_range`, `stable`, `alternates`(×½, ×2), `sections`(구간별 템포), `meter`, `bars[]`, `tempo_curve[]`, `octave_flips`(접기로 고친 창 수)

## 확인
- `--selftest`: 합성 72 BPM 고정 → 안정, 72(또는 144) / 120→96 템포 전환 → 범위 + 구간 2개 / 정확한 beat를 직접 넣어 구간 경계 24±1초
- 3곡(정답): 어노인팅 141, 제이어스 69(발라드), 마커스 약 138 (라이브)

## 실행 (Kaggle 비공개 커널 `gunhe17/worship-bpm-pipeline`, T4)
```
kaggle kernels push -p kaggle --accelerator NvidiaTeslaT4
kaggle kernels output gunhe17/worship-bpm-pipeline -p results/v1
```
