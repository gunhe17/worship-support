# 1. Audio → Key

곡 오디오를 넣으면 **곡 key**와 **곡 중 전조**(위치, 방향, 크기 +1/+2)를 돌려준다.

## 현재 상태
- 실험: [_common/experiments/audio-analysis-test](../_common/experiments/audio-analysis-test/) (3곡, BPM·송폼과 같이 측정). 원시 결과는 [RESULTS.md](../_common/experiments/audio-analysis-test/results/RESULTS.md)에 있다. **아직 채점하지 않았다.**
- 방법: SongFormer 구간마다 Essentia KeyExtractor와 CNN key 모델을 돌리고(믹스 / Demucs stem), 반복되는 chorus끼리 OTI로 비교해 전조를 판정한다.
- 관찰: 마지막 후렴의 key up(+2, +1)은 구간별 key와 OTI에 그대로 드러났다. 반면 Essentia는 구간 하나만 놓고 보면 5도 관계 key(V)로 자주 흔들렸다.
- 라이선스: Essentia는 AGPL이고 일부 CNN 모델은 비상업 라이선스다. 상업용이면 대체 모델이 필요하다 ([survey.md](survey.md) 2.9).

## 파일
- [experiments/key-pipeline](experiments/key-pipeline/): key 전용 파이프라인 (librosa 크로마 + 템플릿 + Viterbi + 전조 규칙, 라이선스 제약 없음)
- [experiments/key-model-sweep](experiments/key-model-sweep/): 가용 key 모델 전부를 합성 30곡 + 정답 3곡 + 500곡에 한 번에 실행 (진행 중)
- [survey.md](survey.md): key 조사 종합 (profile 방식, CNN, local key와 전조, 코드 인식, 권장 파이프라인)
- [sources/](sources/): Claude·Grok 조사 원문
- 공통 조사: [../_common/audio-survey-overview.md](../_common/audio-survey-overview.md)

## 쟁점과 결정 (2026-10-07, key-pipeline v1 기준)
### 결정
1. ~~곡 key 정의~~ → **결정(2026-10-07): 우선 구간별 key를 보여준다.** 곡 key 하나로 줄이는 규칙은 구간별 결과를 본 뒤 사용자가 판단
2. ~~나란한조(F minor ↔ Ab major)~~ → **결정: 하나를 내고(차순위에 나란한조 표시) 채점은 둘 다 정답.** 엄격 채점과 나란한조 허용 채점을 따로 집계
3. ~~정답 출처~~ → **결정: 공개 데이터셋 채점(GTZAN key, GiantSteps)은 우선순위 낮음 — 보류** (2026-10-07 갱신). 지금은 합성 곡(정답 확실) + 기존 3곡 + 500곡(정답 없이 방법 간 비교)으로 본다. 찬양곡 정답은 만들지 않음
4. ~~비교 대상~~ → **결정: `detect_musical_key.py`의 Essentia·librosa 두 방식을 baseline으로 같이 돌린다.** Essentia(AGPL)는 연구 비교용으로만 쓰고 제품에는 넣지 않음
5. ~~Kaggle 계정~~ → **기본 계정(gunhe17)으로 실행** (2026-10-07 갱신). xxjiinn 계정은 커널에서 GPU·인터넷이 막혀(전화번호 인증 미완으로 추정) `xxjiinn/worship-key-pipeline` v2가 demucs 설치 실패로 오류 종료
### 기술 쟁점 (실험으로 해결)
6. **5도·관계조 흔들림**: 마커스 E ↔ B, 제이어스 Ab ↔ F minor
7. **전조 판정이 이웃 구간끼리만 비교**: 사이에 낀 짧은 오검출 구간(F minor, F# minor)이 실제 전조를 가려 `mode` 변화로 분류됨
8. **selftest 실패**: 합성 곡 마지막 20초 Ab 구간이 사라짐 (8마디 합치기 추정, 미확인)
