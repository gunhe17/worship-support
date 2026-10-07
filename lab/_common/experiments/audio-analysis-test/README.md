# 곡 오디오 분석 시험 (audio-analysis-test)

근거 조사: [../../audio-survey-overview.md](../../audio-survey-overview.md) (항목별: [key](../../../audio-to-key/survey.md) · [BPM](../../../audio-to-bpm/survey.md) · [arrangement](../../../audio-sheet-to-arrangement-form/survey-audio.md))

## 목표
1. 후보 모델이 **GPU 없이 로컬(Apple M3, 24GB, CPU/MPS)에서** 설치·실행되는지 확인한다.
2. 한국의 유명 찬양팀 3팀에서 곡을 1곡씩 골라 **key(전조 포함) · BPM · arrangement**를 측정하고 정답과 비교한다.
3. 결과를 보고 모델 조합과 다음 단계(검증 세트 확대, 파이프라인 구현)를 정한다.

## 판정 기준
| 항목 | 통과 기준 |
|---|---|
| BPM | 정답과 ±4% 이내 (Acc1). ×2, ÷2로 맞은 경우는 "octave 오류"로 따로 기록 |
| Key | 곡 key 정확히 일치. 관계조나 5도 혼동은 부분 정답으로 기록 |
| 전조 | 실제 전조가 있는 곡에서 전조 여부, 방향과 크기(+1/+2), 대략적 위치(±1 구간) |
| Arrangement | 구간 순서가 정답 sequence와 대체로 일치(라벨 이름 매핑 후). 경계 오차는 눈으로 확인 |
| 실행 | CPU 곡당 실행 시간 기록 |

## 절차
1. **환경**: `uv venv -p 3.12` + librosa, essentia, beat-this, demucs, madmom(git) 설치. `scripts/`에 스크립트를 둔다.
2. **스모크 테스트**: 합성 곡(72 BPM, G→Ab 전조)으로 각 모델 동작 확인 (`scripts/smoke.py`).
3. **곡 선정**: 찬양팀 3팀과 각 1곡을 검색해 고르고, 정답(key, 전조, BPM, 구간 순서)을 공개 자료(악보·코드 사이트 등)로 기록한다.
4. **음원 확보**: `audio/`에 저장한다(git 제외). 개인 시험용으로만 쓰고 배포하지 않는다.
5. **측정**
   - BPM: Beat This!(CPU, DBN 없음) median 간격, librosa tempo 비교
   - 구간: SongFormer(CPU 가능 여부 확인) 또는 대체 모델
   - Key: 구간별 Essentia(krumhansl, hpcpSize=36), madmom CNN, 템플릿. 반복 후렴 OTI로 전조 확인
6. **기록**: 각 단계는 [LOG.md](LOG.md)에, 곡별 결과는 `results/`에 남긴다.
7. **정리**: 판정표 작성 후 다음 단계 제안.
