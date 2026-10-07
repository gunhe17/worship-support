# key 모델 일괄 시험 (key-model-sweep) — 계획, 대기 중

상태: **실행 중** (2026-10-07, 커널 `gunhe17/worship-key-sweep`, T4). 처음엔 key-pipeline 작업 뒤로 미뤘으나 사용자가 "빈 Kaggle 세션에 지금 돌리기"로 변경.

- 코드: `sweep_body.py` + `build.py` → `kaggle/sweep.py` (key-pipeline/kaggle/key.py를 빌드 시점 사본으로 고정. 원본은 다른 세션이 수정 중이라 건드리지 않음)
- GiantSteps·GTZAN 등 공개 정답 세트는 다른 세션(xxjiinn 계정)이 채점 중이라 여기서는 빼고, 합성 30곡 + 정답 3곡 + 찬양 500곡만

## 목표
Kaggle 한 번의 실행으로 key 방법 여러 개를 같은 곡들에 돌리고, **중간 특징을 모두 저장**해 이후 후처리(Viterbi 파라미터, 전조 규칙, 곡 key 정의)는 오디오 없이 CPU 커널로 다시 돌릴 수 있게 한다.

## 결정 (2026-10-07)
- 장르별 key 정답 세트(GTZAN key 등)는 **쓰지 않는다**
- 실행 계정: **기본 계정(gunhe17)**
- 시작 시점: ~~key-pipeline 작업이 끝난 뒤~~ → 지금 (사용자 변경)

## 입력
- 합성 곡 세트 (커널에서 생성, 정답 확실): 장/단조 × 템포 60/90/140 × 전조 없음 / +1 / +2 / 관계조 전환 / 되돌아오는 전조, 약 30곡
- 정답 있는 찬양 3곡: `gunhe17/worship-audio-analysis-test`
- 찬양 500곡(정답 없음): `gunhe17/worship-audio-500`
- (확인 필요) GiantSteps key `xvanlee/giantsteps-key`: 전자음악 정답 세트. "장르 정답 사용 안 함" 결정에 포함되는지 시작 전에 사용자에게 확인

## 절차
1. 곡마다 한 번: 디코딩 → Demucs(bass+other) → 튜닝 → beat
2. 특징 저장(npz, float16): 믹스/stem × {CQT 크로마, CENS, Essentia HPCP 36bin} × beat 단위, madmom CNN key 활성값(창별)
3. 방법별 key (특징 재사용)
   - A. key-pipeline (템플릿 + Viterbi + 전조 규칙) — 그 시점의 최신 버전
   - B. 사용자 제공 `detect_musical_key.py` 방식 (15초/5초 창 + 곡 전체 사전확률 Viterbi)
   - C. Essentia KeyExtractor 프로파일 5종 (krumhansl, temperley, edma, bgate, shaath), 곡 전체 + 창별
   - D. madmom CNN key, 곡 전체 + 창별
   - E. 템플릿 변형: 프로파일 4종 × 창 8/16/32 beat × 믹스/stem
4. 출력: 방법마다 곡 key, 1·2위 key·점수, 구간, 전조 이벤트 + 창별 24-key 점수 행렬
5. 커널 안 집계
   - 정답 세트: 정확 / 5도 / 관계조 / 같은 으뜸음 / MIREX 가중 점수, 전조 검출 정밀도·재현율
   - 500곡: 방법 간 일치도, 의견이 갈리는 곡, +1/+2 key up 후보 목록(사람 확인용)
- 라이선스 표시: Essentia(AGPL)·madmom CNN(비상업)은 연구 비교용, 서비스 후보는 A·E(librosa/numpy)
- 예상 비용: T4 3–4시간 (500곡 Demucs가 대부분)
