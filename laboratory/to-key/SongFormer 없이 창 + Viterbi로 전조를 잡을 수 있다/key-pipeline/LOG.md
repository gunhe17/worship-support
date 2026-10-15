# 진행 기록

## 2026-10-07

### 1. 파이프라인 작성, v1 실행
- `kaggle/key.py` 한 파일: 한 곡 / selftest / Kaggle 일괄(selftest + 3곡 × 믹스·stems)
- 이전 `analyze.py` 대비: SongFormer·madmom·Essentia 제거, 슬라이딩 창 + Viterbi, 전조 판정 규칙 코드화
- OTI(반복 chorus 비교)는 구간 라벨이 필요해서 뺌 → arrangement 기능과 합칠 때 추가
- 커널 `gunhe17/worship-key-pipeline` v1 push (데이터셋 `gunhe17/worship-audio-analysis-test`, 3곡)

### 2. v1 결과 (Kaggle T4, 약 2분) → `results/v1/`
- **selftest 실패**: 합성 곡 전체를 G major 하나로 냄 (Ab 20초 구간을 8마디 합치기에서 잃은 것으로 추정, 미확인)
- 어노인팅: 믹스·stems 모두 E major, 변화 없음 ✅
- 제이어스: Ab major ✅(나란한조 정답). 3:32 F minor → Bb major를 `mode`로 분류 → +2 key up을 전조로 못 잡음 (중간에 F minor 구간이 끼어서)
- 마커스: 믹스 C major ✗ / stems F major ✗. E ↔ B(5도) 반복 흔들림, 3:15 무렵 F# minor → F major(stems)로 전조 시점은 보이지만 `mode`로 분류
- 문제: ① 5도·관계조 흔들림을 Viterbi가 못 누름 ② 변화를 이웃 구간끼리만 비교해서, 사이에 낀 짧은 오검출 구간이 전조를 가림 ③ 곡 key를 "가장 오래 유지된 key"로 정해서 흔들리는 곡에서 틀림

### 3. 쟁점 결정 (README "쟁점과 결정")
- 구간별 key를 먼저 보여주고 곡 key 정의는 나중에 / 나란한조는 둘 다 정답 / 정확도는 공개 세트만 / baseline은 Essentia·librosa 둘 다 / key 작업은 fallback 계정(xxjiinn)
- xxjiinn에 비공개 데이터셋 업로드: `xxjiinn/worship-audio-analysis-test`(3곡 wav, ready), `xxjiinn/worship-audio-500`(업로드 중)

### 4. v2 채점 틀 작성, 실행
- 공개 key 세트 탐색: McGill Billboard(Kaggle)는 코드 주석만 있고 오디오 없음 → 제외. GTZAN key 라벨(alexanderlerch/gtzan_key)을 BPM 작업이 쓴 GTZAN 오디오와 짝지음. GiantSteps-key는 Kaggle에 오디오 포함
- `key.py`에 baseline 2개(사용자 코드 함수 그대로), 채점(MIREX 가중, 관계조 허용), 공개 세트 일괄 실행(멀티프로세스) 추가. selftest에 key 이름 파싱·채점 assert 추가
- 파이프라인 자체(쟁점 6~8)는 아직 고치지 않음: 먼저 v1 vs baseline 기준 수치를 잼
- 커널 `xxjiinn/worship-key-pipeline` v1 push (CPU)
- v2 결과(`results/v2/`): `xxjiinn/worship-key-pipeline` **오류 종료** — 커널에서 인터넷 없음(pip demucs 실패), GPU 없음(CPU) → selftest 실패 후 어노인팅 pipe 1건만 남기고 `ModuleNotFoundError: demucs`. 공개 세트 채점은 실행되지 않음
- 이후 이 세션 종료. 공개 세트 채점은 우선순위 낮음으로 보류, key 실험은 기본 계정의 key-model-sweep에서 이어감 (2026-10-07)
