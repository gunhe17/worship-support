# BPM·beat 방법 일괄 시험 (bpm-model-sweep)

조사: [../../survey-methods-2026-10.md](../../survey-methods-2026-10.md), [../../survey.md](../../survey.md) 1.2–1.5

## 목표
BPM·beat 방법 여러 개를 같은 곡들에 돌려 정확도(GTZAN)와 찬양곡 동작(500곡)을 비교한다. key-model-sweep과 같은 방식.

## 구성 (12시간 제한 때문에 커널 3개 동시 + 집계 1개)
| 커널 | 장치 | 방법 |
|---|---|---|
| `gunhe17/worship-bpm-sweep-a` | T4 | Beat This! final0 / small0 / final0+DBN, DeepRhythm, All-In-One |
| `gunhe17/worship-bpm-sweep-b` | CPU 4프로세스 | madmom RNN+DBN(beat·downbeat), madmom 템포, BeatNet(오프라인) |
| `gunhe17/worship-bpm-sweep-c` | CPU 4프로세스 | librosa beat_track / tempo / PLP, Essentia multifeature / degara / Percival / TempoCNN |
| `gunhe17/worship-bpm-sweep-s` | CPU | A·B·C 출력 집계·채점 |

- 대상 순서: GTZAN 999클립(정답) → 정답 3곡 → 찬양 500곡. 10.5시간에 새 곡 시작을 멈춤, 곡마다 결과 파일을 바로 저장
- beat를 내는 방법은 bpm-pipeline의 analyze(반·두 배 통일, 안정/범위, 구간, 마디)를 똑같이 적용 (`build.py`가 bpm.py 사본을 넣음)
- 집계: GTZAN Acc1/Acc2·반·두 배 방향·beat F·downbeat F·박자, 500곡 템포 분포·안정 비율·구간 수·연속 2박 마디·방법 간 일치도
- Logic Pro(Smart Tempo/BPM Counter)는 CLI·스크립트 수단이 없어 제외 (AU 미등록, AppleScript는 기본 명령만). 필요하면 화면 자동화로 소수 곡 참고 기준
- 라이선스: madmom 모델·TempoCNN 비상업, Essentia·DeepRhythm AGPL, BeatNet CC BY, Beat This!·All-In-One 코드 MIT
