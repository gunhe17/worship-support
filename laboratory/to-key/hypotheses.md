# to-key 가설

## SongFormer 없이 창 + Viterbi로 전조를 잡을 수 있다

### experiment-key-pipeline-v1 — 정답 4곡에서 key-pipeline 입력 2가지 비교
where: lab/to-key/SongFormer 없이 창 + Viterbi로 전조를 잡을 수 있다/key-pipeline
- 데이터: synth-keyup-60s · worship-3
- 틀: {조건} → librosa(fn=beat) → beat-chroma → key-template(window=16, hop=4, profile=krumhansl) → viterbi(stay=0.99, bonus=3) → merge-short(min=32) → modulation-classify(strength=0.5)
- 조건 A: (없음)
- 조건 B: demucs(stems=bass+other)
- 지표: modulation-recall · song-key-acc
- 기준: A.modulation-recall = 100%
- 환경: kaggle-t4 × 1
- 결과: 실패

### 사실

#### fact-adjacent-compare-hides-modulation — 전조를 이웃 구간끼리만 비교해서 사이에 낀 짧은 오검출 구간이 실제 전조를 가린다.
kind: 실패 요인 · about: [to-key]

#### fact-viterbi-cannot-suppress-fifth — 구간 단위 Viterbi는 5도·관계조로 흔들리는 판정을 누르지 못한다.
kind: 실패 요인 · about: [to-key]

#### fact-window-viterbi-misses-modulation — 8마디 미만 구간을 이웃에 합치는 규칙이 마지막 후렴의 짧은 전조 구간을 지운다.
kind: 실패 요인 · refutes: [SongFormer 없이 창 + Viterbi로 전조를 잡을 수 있다] · about: [librosa, to-key]

## 곡 전체 사전확률 Viterbi는 곡 key를 잘 맞힌다

### experiment-key-model-sweep — 곡 533개에서 key 방법 49개 비교
tests: [곡 전체 사전확률은 전조를 지운다] · where: lab/to-key/곡 전체 사전확률 Viterbi는 곡 key를 잘 맞힌다/key-model-sweep
- 데이터: synth-key-30 · worship-3 · worship-500
- 틀: demucs(stems=bass+other) → {조건}
- 조건 A: key-pipeline(input=mix|stem)
- 조건 B: detect-musical-key(variant=essentia|librosa)
- 조건 C: key-template(profile=kk|temperley|albrecht, input=mix|stem)
- 조건 D: essentia(profile=diatonic|krumhansl|temperley|weichai|tonictriad|temperley2005|thpcp|shaath|gomez|noland|faraldo|pentatonic|edmm|edma|bgate|braw, input=mix|stem)
- 조건 E: essentia(window=on, profile=temperley|bgate|edma)
- 조건 F: madmom-rnn(input=mix|stem)
- 조건 G: madmom-rnn(window=10s)
- 조건 H: madmom-chord-key
- 지표: song-key-acc · modulation-recall
- 기준: B.song-key-acc ≥ 90%
- 환경: kaggle-t4 × 1 · kaggle-cpu × 1 · 11h
- 결과: 성공

### 사실

#### fact-global-prior-erases-modulation — 곡 전체 사전확률은 곡에 적게 나온 마지막 후렴의 key를 불리하게 만들어 전조를 경로에서 지운다.
kind: 부수 사실 · supports: [곡 전체 사전확률은 전조를 지운다] · about: [detect-musical-key]

#### fact-global-prior-wins-song-key — 곡 전체 사전확률이 창마다 5도·관계조로 흔들리는 판정을 곡의 주 key 쪽으로 끌어당긴다.
kind: 성공 요인 · supports: [곡 전체 사전확률 Viterbi는 곡 key를 잘 맞힌다] · about: [detect-musical-key, essentia]

#### fact-synthetic-minor-ambiguous — i–VI–III–VII로 만든 합성 단조 곡은 나란한조 장조와 화음이 같아 정답 채점이 모호하다.
kind: 부수 사실 · about: [to-key]

## 곡 전체 사전확률은 전조를 지운다
