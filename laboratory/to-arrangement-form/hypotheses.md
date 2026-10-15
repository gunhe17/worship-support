# to-arrangement-form 가설

## SongFormer 구간과 구간별 분석으로 key·BPM·송폼을 함께 잴 수 있다

### experiment-audio-analysis-test — 정답 4곡에서 SongFormer 구간 분석과 STT 비교
where: lab/to-arrangement-form/SongFormer 구간과 구간별 분석으로 key·BPM·송폼을 함께 잴 수 있다/audio-analysis-test
- 데이터: worship-3 · synth-keyup-60s
- 틀: {조건}
- 조건 A: songformer(window=420s|180s) → section-tempo → section-key → chorus-oti
- 조건 B: whisper(model=large-v3, vad=on|off, input=mix|vocals)
- 조건 C: whisper-turbo-ko(input=mix|vocals)
- 조건 D: qwen3-asr(aligner=on, input=mix|vocals)
- 지표: run-complete · stt-cer · modulation-recall
- 기준: A(window=420s).run-complete = 100%
- 환경: kaggle-t4 × 1
- 결과: 실패

### 사실

#### fact-per-section-key-shows-keyup — 구간별 key와 반복 후렴 OTI에는 마지막 후렴의 key up이 드러난다.
kind: 부수 사실 · about: [to-key]

#### fact-songformer-noncommercial — SongFormer는 MuQ 가중치(CC-BY-NC) 때문에 상업적으로 쓸 수 없다.
kind: 부수 사실 · about: [songformer]

#### fact-songformer-oom-long-window — SongFormer 420초 창은 6분 전후 곡에서 T4 메모리(16GB)를 넘긴다.
kind: 실패 요인 · about: [songformer]

#### fact-whisper-vad-drops-singing — Whisper의 VAD는 원곡 믹스에서 노래 구간을 음성이 아닌 것으로 보고 잘라 버린다.
kind: 실패 요인 · about: [whisper]

## 구간별 STT 가사를 악보 가사와 대조하면 송폼 part를 판정할 수 있다

### experiment-songform-crop-stt — 찬양 10곡에서 구간별 STT 3종 비교
where: lab/to-arrangement-form/구간별 STT 가사를 악보 가사와 대조하면 송폼 part를 판정할 수 있다/songform-crop-stt
- 데이터: worship-10
- 틀: demucs(stems=vocals) → songformer(window=180s) → section-crop(pad=1.5s) → {조건} → part-match(cer=0.5)
- 조건 A: whisper(model=large-v3, input=mix|vocals)
- 조건 B: whisper-turbo-ko(input=mix|vocals)
- 조건 C: qwen3-asr(input=mix|vocals)
- 지표: stt-cer · part-acc
- 기준: A(input=mix).part-acc ≥ 80%
- 환경: kaggle-t4 × 1
- 결과: 성공

### 사실

#### fact-part-match-by-text — 악보에 태그된 가사가 있으면 part 판정이 음성 인식 문제가 아니라 텍스트 대조 문제가 된다.
kind: 성공 요인 · supports: [구간별 STT 가사를 악보 가사와 대조하면 송폼 part를 판정할 수 있다] · about: [to-arrangement-form]

#### fact-songformer-labels-wrong — SongFormer의 기능 라벨은 가사로 확인하면 자주 틀린다.
kind: 부수 사실 · supports: [] · about: [songformer]

#### fact-whisper-mix-best-cer — 노래 가사 STT는 보컬을 분리한 입력보다 원곡 믹스를 넣을 때 더 정확하다.
kind: 부수 사실 · supports: [] · about: [whisper]

## 마디 격자 위 CBM으로 송폼 경계를 ±1마디 안에서 찾을 수 있다

### experiment-boundary-bench — 공개 대중가요 300곡에서 마디 경계 방법 4개 비교
where: lab/to-arrangement-form/마디 격자 위 CBM으로 송폼 경계를 ±1마디 안에서 찾을 수 있다/boundary-bench
- 데이터: songformbench-hx200 · songformbench-cn100
- 틀: bars(grid=harmonix|beat-this) → {조건}
- 조건 A: grid-8bar
- 조건 B: barwise-tf → foote-bar
- 조건 C: laplacian-bar
- 조건 D: barwise-tf → cbm(penalty=modulo8|none)
- 지표: boundary-f(tol=1bar) · boundary-f(tol=0bar)
- 기준: D(penalty=modulo8).boundary-f ≥ 70%
- 환경: kaggle-t4 × 1
- 결과: 성공

### 사실

#### fact-cbm-bar-boundary-70 — 마디 격자 위 CBM은 공개 대중가요 300곡에서 송폼 경계의 약 70%를 ±1마디 안에서 찾고, 같은 격자의 Laplacian·Foote·8마디 등간격보다 정확하다.
kind: 성공 요인 · supports: [마디 격자 위 CBM으로 송폼 경계를 ±1마디 안에서 찾을 수 있다] · about: [as-seg, to-arrangement-form]

#### fact-beat-this-grid-costs-little — 정답 첫 박 대신 Beat This!+DBN 첫 박으로 마디 격자를 만들어도 경계 F@1bar는 약 2점만 떨어진다.
kind: 부수 사실 · about: [beat-this, madmom-dbn]

#### fact-modulo8-prior-small — 8마디 길이 벌점은 CBM의 경계 F@1bar를 거의 바꾸지 않는다.
kind: 부수 사실 · about: [as-seg]
