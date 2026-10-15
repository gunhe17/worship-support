# to-bpm 가설

## Beat This!는 공개 세트에서 충분히 정확하다

### experiment-gtzan — GTZAN 999곡에서 bpm-pipeline 채점
where: lab/to-bpm/곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다/bpm-pipeline (kaggle-gtzan)
- 데이터: gtzan
- 틀: {조건} → octave-fold → bars
- 조건 A: beat-this(model=final0)
- 지표: tempo-acc(tol=4%) · beat-f1 · downbeat-f1
- 기준: A.tempo-acc ≥ 90%
- 환경: kaggle-t4 × 1
- 결과: 성공

### 사실

#### fact-beat-this-gtzan-accuracy — Beat This!의 beat 위치가 장르와 무관하게 정확해서 반·두 배만 정리하면 템포가 맞는다.
kind: 성공 요인 · supports: [Beat This!는 공개 세트에서 충분히 정확하다] · about: [beat-this]

## Beat This!는 급격한 템포 전환을 바로 따라간다

### experiment-synth-tempo-change — 합성 전환 곡에서 Beat This! 템포 전환 추적 측정
where: lab/to-bpm/곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다/bpm-pipeline (v2–v5)
- 데이터: synth-120-96
- 틀: {조건} → segment(smooth=5, tol=2%, run=16)
- 조건 A: beat-this(model=final0)
- 조건 B: oracle-beats
- 지표: change-lag
- 기준: A.change-lag ≤ 1초
- 환경: kaggle-t4 × 1
- 결과: 실패

### 사실

#### fact-beat-this-lags-abrupt-change — Beat This!는 템포가 순간적으로 바뀐 뒤 3–5초 동안 이전 템포 간격으로 beat를 찍는다.
kind: 실패 요인 · refutes: [Beat This!는 급격한 템포 전환을 바로 따라간다] · about: [beat-this]

## Beat This!는 전곡 실녹음과 템포 변화 곡에서도 가장 정확하다

from: [fact-beat-this-gtzan-accuracy]

### experiment-gt-sweep — 정답 있는 전곡 277곡에서 BPM 방법 14개 채점
tests: [Beat This!는 전곡 실녹음과 템포 변화 곡에서도 가장 정확하다] · where: lab/to-bpm/Beat This!는 전곡 실녹음과 템포 변화 곡에서도 가장 정확하다/gt-sweep
- 데이터: rwc-g-27 · rwc-p-100 · slakh-tempo-150
- 틀: {조건} → octave-fold → stability(tol=4%) → segment → bars
- 조건 A: beat-this(model=final0|small0)
- 조건 B: beat-this(model=final0) → madmom-dbn
- 조건 C: madmom-rnn → madmom-dbn
- 조건 D: madmom-tempo
- 조건 E: beatnet
- 조건 F: librosa(fn=beat_track|tempo|plp)
- 조건 G: essentia(fn=multifeature|degara|percival|tempocnn)
- 조건 H: deeprhythm
- 지표: tempo-acc(tol=4%) · local-tempo-acc(tol=4%) · beat-f1 · downbeat-f1
- 기준: A(model=final0).beat-f1 ≥ 0.85
- 환경: kaggle-t4 × 1 · kaggle-cpu × 2 · 10.5h
- 결과: 성공

### 사실

#### fact-beat-this-best-on-unseen-full-songs — 어느 모델도 학습하지 않은 실녹음 전곡에서도 Beat This!는 템포를 모두 맞히고, 박 위치는 madmom DBN과 함께 최상위다(둘의 차이는 유의하지 않다).
kind: 성공 요인 · supports: [Beat This!는 전곡 실녹음과 템포 변화 곡에서도 가장 정확하다] · about: [beat-this, to-bpm]

#### fact-rwc-p-leak-small — 학습한 세트(RWC-P)에서 Beat This!의 박 정확도는 학습하지 않은 세트(RWC-G)보다 조금 높을 뿐이라 학습 누수의 영향은 작다.
kind: 부수 사실 · about: [beat-this]

#### fact-synth-tempo-change-harder — 합성 곡(Slakh)은 템포가 바뀌든 일정하든 실녹음보다 템포·박 정확도가 낮고(바뀌는 곡이 조금 더 낮지만 유의하지 않다), DBN을 붙이면 Beat This!의 구간 템포·박 F가 유의하게 오른다.
kind: 부수 사실 · about: [beat-this, madmom-dbn, to-bpm]

#### fact-tempo-trackers-steadier-local-tempo — 학습하지 않은 실녹음(RWC-G)의 완만한 템포 흔들림에서는 박을 하나씩 찍는 Beat This!보다 madmom DBN과 TempoCNN이 구간 템포를 더 고르게 맞히지만, 합성 곡의 급격한 템포 변화에서는 그렇지 않다.
kind: 부수 사실 · about: [madmom-dbn, essentia, beat-this]

## DBN을 붙이면 연속 2박 마디가 사라진다

### experiment-bpm-model-sweep — 찬양·공개 1,502곡에서 BPM 방법 15개 비교
where: lab/to-bpm/DBN을 붙이면 연속 2박 마디가 사라진다/bpm-model-sweep
- 데이터: gtzan · worship-3 · worship-500
- 틀: {조건} → octave-fold → stability(tol=4%) → segment → bars
- 조건 A: beat-this(model=final0|small0)
- 조건 B: beat-this(model=final0) → madmom-dbn
- 조건 C: madmom-rnn → madmom-dbn
- 조건 D: madmom-tempo
- 조건 E: beatnet
- 조건 F: librosa(fn=beat_track|tempo|plp)
- 조건 G: essentia(fn=multifeature|degara|percival|tempocnn)
- 조건 H: deeprhythm
- 조건 I: all-in-one
- 지표: tempo-acc(tol=4%) · double-bar-rate
- 기준: B.double-bar-rate = 0%
- 환경: kaggle-t4 × 1 · kaggle-cpu × 2 · 10.5h
- 결과: 성공

### 사실

#### fact-dbn-costs-little — DBN을 붙여도 beat·downbeat 위치 정확도는 0.01 정도만 떨어진다.
kind: 부수 사실 · supports: [파이프라인을 Beat This!+DBN으로 바꿔도 된다] · about: [madmom-dbn]

#### fact-dbn-forces-even-bars — DBN은 템포와 마디 길이가 일정하다고 가정해 반 마디마다 찍히던 downbeat를 한 마디 단위로 묶는다.
kind: 성공 요인 · supports: [DBN을 붙이면 연속 2박 마디가 사라진다, 파이프라인을 Beat This!+DBN으로 바꿔도 된다] · about: [madmom-dbn, beat-this]

#### fact-tempo-methods-plateau — 템포만 보면 상위 방법들의 정확도가 비슷해 방법을 바꿔도 템포는 크게 좋아지지 않는다.
kind: 부수 사실 · about: [to-bpm, madmom-rnn, beat-this]

## 곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다

### experiment-bpm-pipeline-v1 — 정답 5곡에서 템포 영역 4가지 비교
where: lab/to-bpm/곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다/bpm-pipeline
- 데이터: worship-3 · synth-72 · synth-120-96
- 틀: beat-this(model=final0) → local-tempo(window=8) → {조건} → stability(ratio=1.08)
- 조건 A: octave-fold(feel=auto|ballad|mid|up)
- 지표: tempo-acc(tol=4%)
- 기준: A(feel=auto).tempo-acc = 100%
- 환경: kaggle-t4 × 1
- 결과: 성공

### 사실

#### fact-auto-octave-fold-works — 곡 전체 중앙값을 기준 옥타브로 삼으면 구간마다 반·두 배로 뒤집히던 템포가 한 단위로 정리된다.
kind: 성공 요인 · supports: [곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다] · about: [beat-this, to-bpm]

#### fact-feel-hint-harmful-when-wrong — 템포 영역 정보는 틀리게 주면 BPM을 반·두 배로 뒤집어 정보가 없는 것보다 해롭다.
kind: 부수 사실 · supports: [곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다] · about: [to-bpm]

## 파이프라인을 Beat This!+DBN으로 바꿔도 된다

from: [fact-dbn-forces-even-bars, fact-dbn-costs-little]

### experiment-bars-check — 정답 있는 전곡 273곡과 찬양 8곡(듣기)에서 Beat This! DBN 유무별 마디 채점
tests: [파이프라인을 Beat This!+DBN으로 바꿔도 된다] · where: lab/to-bpm/파이프라인을 Beat This!+DBN으로 바꿔도 된다/bars-check
- 데이터: rwc-g-27 · rwc-p-100 · slakh-tempo-150 · worship-500
- 틀: {조건} → bars
- 조건 A: beat-this(model=final0)
- 조건 B: beat-this(model=final0) → madmom-dbn
- 지표: meter-acc · bar-length-acc(tol=4%) · downbeat-f1 · double-bar-rate
- 기준: B.meter-acc ≥ 0.95
- 환경: local × 1
- 결과: 성공

### 사실

#### fact-dbn-clicks-sound-right — 찬양 무작위 8곡(3박 3곡 포함)에 Beat This!+DBN의 박·첫 박 클릭을 얹어 들었을 때 어긋난 곳이 없었다.
kind: 성공 요인 · supports: [파이프라인을 Beat This!+DBN으로 바꿔도 된다] · about: [beat-this, madmom-dbn, to-bpm]

#### fact-dbn-steadier-bars — Beat This!+DBN은 전곡 정답 세트에서 박자를 98–99% 맞히고 마디 길이가 ±4% 안인 곡이 90–98%로, DBN 없는 Beat This!보다 마디가 안정적이다.
kind: 성공 요인 · supports: [파이프라인을 Beat This!+DBN으로 바꿔도 된다] · about: [beat-this, madmom-dbn]

#### fact-triple-meter-unverified — 정답 세트가 거의 모두 4/4(RWC 126/127, Slakh 142/146)라 3박 계열 박자 판정은 정답으로 검증되지 않았다.
kind: 부수 사실 · about: [to-bpm]
