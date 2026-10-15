# 공유 노드

## 도구

### all-in-one — All-In-One
license: 코드 MIT
KAIST, 2023. 분리 음원 → beat·downbeat·템포·구간 라벨

### audiveris — Audiveris
license: AGPL
전통 OMR. 악보 → MusicXML

### beat-this — Beat This!
license: MIT
JKU 린츠, 2024. 합성곱 + Transformer로 beat·downbeat를 직접 예측. 변형: final0, small0

### beatnet — BeatNet
license: CC BY
로체스터대, 2021. CRNN + 파티클 필터/DBN

### deeprhythm — DeepRhythm
license: AGPL
CNN 템포 분류. 곡당 0.02초

### demucs — Demucs
license: MIT
음원 분리 (htdemucs). bass+other로 화성 성분만 남김

### detect-musical-key — detect_musical_key.py
license: Essentia AGPL / librosa
사용자 제공 코드. 15초/5초 창 + 곡 전체 사전확률 Viterbi

### essentia — Essentia
license: AGPL
UPF MTG. RhythmExtractor2013, Percival, TempoCNN, KeyExtractor, HPCP

### librosa — librosa
license: ISC
파이썬 음악 분석 라이브러리. beat_track, tempo, PLP, 크로마

### madmom-dbn — madmom DBN
license: 코드 BSD
동적 베이즈망. beat 확률에서 템포·박자가 일정한 beat·마디 위치를 고른다. 학습 모델이 아닌 알고리즘

### madmom-rnn — madmom RNN
license: 모델 비상업
JKU 린츠, 2016. beat·downbeat 확률을 내는 순환 신경망. CNN key·코드 모델도 같은 패키지

### opencv — OpenCV / numpy
license: Apache-2.0
이진화·형태 연산·오선 검출 구현

### qwen3-asr — Qwen3-ASR
license: Apache-2.0
음성 인식 + ForcedAligner

### qwen3-vl — Qwen3-VL
license: Apache-2.0
비전 LLM. 악보 → ABC·가사·메타데이터

### songformer — SongFormer
license: MuQ 가중치 비상업
곡 구조(구간·기능 라벨) 추출

### whisper-turbo-ko — whisper-large-v3-turbo-korean (ghost613)
license: 미확인
한국어 튜닝 Whisper

### whisper — Whisper
license: MIT
OpenAI 음성 인식. large-v3, turbo

### as-seg — as_seg
license: BSD-3

Marmoret·Cohen·Bimbot, 2023. 마디 단위 자기유사도(Barwise TF)와 CBM 분할. 마디 목록을 직접 받는다

## 데이터셋

### gtzan — GTZAN
n: 999 · unit: 곡 · truth: 있음 · where: TempoBeatDownbeat/gtzan_tempo_beat (10장르 × 100, 각 30초)

### openewld-20-clean — OpenEWLD 20곡 렌더 (clean)
n: 20 · unit: 장 · truth: 있음

### openewld-20-lowres — OpenEWLD 20곡 렌더 (저해상도)
n: 20 · unit: 장 · truth: 있음

### rwc-g-27 — RWC-G 팝·록·댄스 27곡
n: 27 · unit: 곡 · truth: 있음 · where: Zenodo 18656623 RWC-G.zip (CC BY-NC 4.0) + github rwc-music/rwc-annotations beats/RWC-G (G001–G027)

### rwc-p-100 — RWC-P 팝 100곡
n: 100 · unit: 곡 · truth: 있음 · where: HF taohu/rwc-pop (원본 WAV) + github rwc-music/rwc-annotations beats/RWC-P

### sheets-100 — 찬양 악보 100장 (오선 수 확인)
n: 100 · unit: 장 · truth: 있음

### sheets-500 — 찬양 악보 500장
n: 500 · unit: 장 · truth: 없음

### sheets-6 — 찬양 악보 6장
n: 6 · unit: 장 · truth: 있음

### sheets-worship-14 — 찬양 악보 14장
n: 14 · unit: 장 · truth: 없음

### slakh-tempo-150 — Slakh2100 템포 변화 150곡
n: 150 · unit: 곡 · truth: 있음 · where: HF projectlosangeles/Slakh2100 16 kHz mix + MIDI 템포맵 (템포 변화 100 + 일정 50, seed 0)

### synth-120-96 — 합성 곡 120 → 96 BPM 전환
n: 1 · unit: 곡 · truth: 있음

### synth-72 — 합성 곡 72 BPM 고정
n: 1 · unit: 곡 · truth: 있음

### synth-key-30 — 합성 key 30곡
n: 30 · unit: 곡 · truth: 있음

### synth-keyup-60s — 합성 곡 G → Ab 전조 60초
n: 1 · unit: 곡 · truth: 있음

### worship-10 — 찬양 10곡 (10팀, 정답 가사)
n: 10 · unit: 곡 · truth: 있음

### worship-3 — 정답 찬양 3곡
n: 3 · unit: 곡 · truth: 있음

### worship-500 — 찬양 500곡
n: 500 · unit: 곡 · truth: 없음 · where: kaggle gunhe17/worship-audio-500 (수집 코드 _data/audio-500)

### songformbench-cn100 — SongFormBench 중국어 100곡
n: 100 · unit: 곡 · truth: 있음 · where: HF ASLP-lab/SongFormBench (CC-BY-4.0, BigVGAN 복원음)

### songformbench-hx200 — SongFormBench Harmonix 200곡
n: 200 · unit: 곡 · truth: 있음 · where: HF ASLP-lab/SongFormBench (CC-BY-4.0, BigVGAN 복원음) + 정답 박 github urinieto/harmonixset (MIT)

## 단계

### abc-to-musicxml — ABC → MusicXML 변환

### bars — downbeat로 마디 나누기

### beat-chroma — beat 단위 CQT 크로마
tool: librosa

### bridge-gaps — 끊긴 띠 건너 잇기
tool: opencv

### chorus-oti — 반복 후렴 OTI 비교

### ink-dist — 픽셀 분포로 잉크 기준
tool: opencv

### ink-from-staff — 오선 진하기로 잉크 기준
tool: opencv

### keep-main-part — 음표가 가장 많은 파트만 남기기

### key-pipeline — key-pipeline 전체
tool: librosa

### key-template — 템플릿 상관 key

### local-tempo — beat 창 지역 템포

### madmom-chord-key — 코드 인식 → key
tool: madmom-rnn

### madmom-tempo — madmom 템포 추정
tool: madmom-rnn

### merge-short — 짧은 구간 합치기

### modulation-classify — 전조 판정

### multi-head — 다른 줄 간격 헤드
tool: opencv

### normalize-width — 악보 폭 정규화
tool: opencv

### octave-fold — 곡 중앙값 기준 반·두 배 통일

### oracle-beats — 정확한 beat 시각 직접 넣기

### part-match — 가사 대조로 part 판정

### section-crop — 구간 잘라내기

### section-key — 구간별 key
tool: essentia

### section-tempo — 구간별 BPM
tool: beat-this

### segment — 템포 구간 나누기

### stability — 템포 안정 판정

### staff-comb — 5줄 빗으로 오선 찾기
tool: opencv

### staff-region — 오선 영역 (몸통 + 이어진 획)
tool: opencv

### viterbi — Viterbi 평활

### barwise-tf — 마디마다 log-mel을 같은 칸 수로 재샘플해 펼친 행렬
tool: as-seg

### cbm — 마디 자기유사도 블록 매칭 동적계획 분할
tool: as-seg

### foote-bar — 마디 자기유사도 체커보드 novelty로 경계

### grid-8bar — 첫 마디부터 8마디마다 경계

### laplacian-bar — 마디 반복·이웃 그래프 Laplacian 군집으로 경계
tool: librosa

## 지표

### bar-length-acc — 마디 길이 정확도 (마디 길이 중앙값이 정답 ±tol 안)
unit: % · better: 높을수록

### beat-f1 — beat F1
better: 높을수록

### change-lag — 템포 전환 뒤 따라가기까지 걸린 시간
unit: 초 · better: 낮을수록

### double-bar-rate — 연속 2박 마디가 있는 곡 비율
unit: % · better: 낮을수록

### downbeat-f1 — downbeat F1
better: 높을수록

### faint-staff-kept — 연한 오선이 살아남은 악보 비율
unit: % · better: 높을수록

### local-tempo-acc — 구간 템포 정확도
unit: % · better: 높을수록

### meter-acc — 박자 정확도 (마디당 박 수 최빈값)
unit: % · better: 높을수록

### modulation-recall — 전조 검출 재현율
unit: % · better: 높을수록

### omr-ned — OMR-NED
better: 낮을수록

### part-acc — part 판정 정확도 (가사 있는 구간)
unit: % · better: 높을수록

### run-complete — 메모리 초과 없이 끝난 곡 비율
unit: % · better: 높을수록

### song-key-acc — 곡 key MIREX 가중 점수
unit: % · better: 높을수록

### staff-miss — 놓친 오선 수
unit: 개 · better: 낮을수록

### stt-cer — 가사 STT CER
better: 낮을수록

### tempo-acc — 템포 정확도
unit: % · better: 높을수록

### watermark-removed — 워터마크가 걸러진 악보 비율
unit: % · better: 높을수록

### boundary-f — 송폼 경계 F (처음·끝 경계 제외, 허용 tol)
unit: % · better: 높을수록
