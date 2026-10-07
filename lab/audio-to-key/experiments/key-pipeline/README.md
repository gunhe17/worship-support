# key 전용 파이프라인 (key-pipeline)

이전 실험: [_common/experiments/audio-analysis-test](../../../_common/experiments/audio-analysis-test/) (key·BPM·송폼을 한 스크립트로 측정)

## 목표
key만 계산하는 독립 파이프라인을 만든다. SongFormer(구간)에 의존하지 않고, **비상업 라이선스 모델 없이**(librosa ISC, numpy, 선택 Demucs MIT) 곡 key와 전조를 자동으로 판정한다.

## 절차 ([kaggle/key.py](kaggle/key.py), 조사 [survey.md](../../survey.md) 2.10)
1. 입력: 원곡 믹스, 또는 Demucs htdemucs bass+other (`--stems`)
2. 튜닝 추정 → beat(믹스에서, librosa) → beat 단위 CQT 크로마
3. 16 beat 창, 4 beat 간격으로 24개 key 템플릿(Krumhansl–Kessler)과 상관계수
4. Viterbi(자기 전이 0.99, 같은 장단조 ±1/±2 반음 이동에 가산점) → key 경로
5. 32 beat(8마디) 미만 구간은 더 잘 맞는 이웃 key에 합침
6. 변화 분류: `up +1/+2`, `down`, `relative`, `fifth`, `mode`, `other`. **전조** = 같은 장단조 ±1/±2 반음 + 두 구간 strength ≥ 0.5
7. 출력: 곡 key(가장 오래 유지된 key), 변화 목록, 구간별 key·strength·차순위 key

## 확인
- `--selftest`: 합성 곡(72 BPM, G major 40초 → Ab major 20초)에서 G → Ab `up +1` 전조 하나를 40±8초에 찾아야 통과
- 3곡(정답 있음): 마커스 E → F(약 3:10), 어노인팅 E(전조 없음), 제이어스 F minor / Ab major(나란한조)

## v2: 채점 틀 (공개 세트 + baseline)
- 방법 3개를 같은 입력에 돌림: `pipe`(이 파이프라인), `ess`·`lib`(사용자 `detect_musical_key.py`의 Essentia / librosa+Krumhansl, 15초 창 5초 간격 + 전역 사전확률 Viterbi)
- 공개 세트: GTZAN(오디오 Kaggle `andradaolteanu/...`, 정답 github `alexanderlerch/gtzan_key`, 30초 클립, 전조·불명 -1 제외), GiantSteps-key(EDM 2분 604곡, Kaggle `xvanlee/giantsteps-key`)
- 클립 key = 가장 오래 나온 구간 key (곡 key 정의는 미정이라 **채점용으로만** 씀. 공개 세트는 클립당 key 하나)
- 지표: 정확도(엄격), 관계조 허용 정확도, MIREX 가중(정답 1, 5도 위 0.5, 관계조 0.3, 같은 으뜸음 0.2), 오류 범주(fifth_up/down, relative, parallel, other)
- 찬양 3곡: 방법 3개 + pipe stems의 구간별 key 전부 저장 (구간 타임라인용)

## 실행 (Kaggle, 비공개 커널 `xxjiinn/worship-key-pipeline`, CPU, fallback 계정)
```
export KAGGLE_API_TOKEN=$(grep '^KAGGLE_API_TOKEN_FALLBACK=' .env | cut -d= -f2-)
kaggle kernels push -p kaggle
kaggle kernels output xxjiinn/worship-key-pipeline -p results/v2
```
v1은 `gunhe17/worship-key-pipeline`(T4)에서 돌렸다.
