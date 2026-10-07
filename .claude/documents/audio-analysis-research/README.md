# 곡 오디오 분석 조사: Key(전조 포함) · Arrangement · BPM

- 조사일: 2026-09-28
- 목적: 곡 오디오 파일을 입력하면 **key(곡 중 key up/down 포함)**, **arrangement(예: Verse > Chorus)**, **BPM**을 반환하는 기능의 측정 방법 조사
- 대상 도메인: 예배/CCM 곡 (스튜디오 음원 + 라이브 녹음)

---

## 0. 조사 방법과 범위

### 조사 영역
| 영역 | 세부 주제 |
|---|---|
| BPM | tempo/beat/downbeat tracking, 반/두 배 템포 오류(octave error), 라이브 템포 드리프트, 6/8 박자 |
| Key | 곡 전체 key, 시간에 따른 local key·전조 검출, 보조 수단인 코드 인식 |
| Arrangement | 구간 분할(boundary) + 기능 라벨(verse/chorus/bridge…), 가사 기반 방법, audio-LLM |
| 공통 | 음원 분리(Demucs) 전처리, 평가 지표·데이터셋, 라이선스·설치 가능성, 상용 제품(Moises, Chordify, Mixed In Key, Tunebat, MultiTracks, Loop Community, Planning Center) |
| 예배 도메인 | 가사를 미리 아는 경우가 많음, 라이브 녹음, 마지막 후렴 key up |

### 조사 수단
- **Claude 리서치 에이전트 3개**(BPM / Key / 구조): 웹 검색·페이지 확인으로 논문, 라이브러리, 벤치마크, 라이선스 조사
- **Grok CLI 3개**(BPM / Key / 구조): `x_keyword_search`, `x_semantic_search`, `x_thread_fetch`로 X를 검색하고 웹 검색을 병행. 실무자 의견, 2025~26 최신 동향, 현장 이슈 수집
- 원문 6개는 모두 [sources/](sources/)에 그대로 보존:
  - [claude-bpm.md](sources/claude-bpm.md) · [claude-key.md](sources/claude-key.md) · [claude-structure.md](sources/claude-structure.md)
  - [grok-bpm.md](sources/grok-bpm.md) · [grok-key.md](sources/grok-key.md) · [grok-structure.md](sources/grok-structure.md)

### 핵심 결론 (한 줄)
> 세 요소는 서로 의존하므로 **분석 순서가 중요**하다.
> `beat/downbeat → 구간(마디 경계에 맞춤) → 구간별 key(반복 구간을 서로 비교해 전조 확인)`
> 구간별 tempo도 구간 경계가 정해진 뒤에 계산한다.

---

## 1. BPM

### 1.1 평가 지표 읽는 법
- **Beat F1 (±70ms)**: 비트가 라벨 근처에 찍혔는지만 본다. 오프비트나 반/두 배 템포로 오래 따라가도 점수가 높게 나올 수 있다.
- **CMLt**: 올바른 박 단위(metrical level)로 끊김 없이 이어지는지 본다.
- **AMLt**: 연속성은 요구하지만 반·두 배 템포와 오프비트도 정답으로 인정한다.
- **Acc1**: 곡 전체 템포가 4% 이내로 맞는지. **Acc2**: ×2, ×3, ×½, ×⅓도 정답으로 인정한다. Acc2 − Acc1 차이가 곧 "octave error"의 크기다.
  - 정의: Schreiber ISMIR 2017 https://archives.ismir.net/ismir2017/paper/000137.pdf, 튜토리얼 https://tempobeatdownbeat.github.io/tutorial/intro.html
- MIREX 2025의 Yamaha J-pop 결과를 보면 이 차이가 드러난다. Beat This!는 beat F1 **94.00**인데 CMLc **69.66**, AMLt **89.57**이다. 비트 위치는 대체로 맞히지만 올바른 박 단위를 안정적으로 유지하지는 못한다. (https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results)
  - MIREX에서 Beat This!의 GTZAN F1은 89.02로, 논문의 89.1과 다르다. MIREX는 999곡, 논문은 993곡을 썼기 때문이다.

### 1.2 방법 계열
| 계열 | 도구 | 특징 |
|---|---|---|
| Onset 강도 + 자기상관/tempogram (DSP) | `librosa.feature.tempo`, `librosa.beat.beat_track` | Ellis 2007 동적계획법 방식. 기본값 `start_bpm=120`, `tightness=100`, `std_bpm=1.0`로 120 근처에 강하게 끌린다. 그래서 느린 발라드를 두 배로 잡기 쉽다. 타악기가 약한 곡에 취약하다. 시변 템포(`aggregate=None`)는 기본값에서 꺼져 있다. |
| RNN/TCN + DBN | madmom `RNNBeatProcessor` + `DBNBeatTrackingProcessor` / `DBNDownBeatTrackingProcessor` | 이전 세대 SOTA. DBN이 일정한 템포와 박자를 강제하므로 연속성 지표는 좋다. |
| DBN 없는 딥러닝 | **Beat This!** (Foscarin, Schlüter, Widmer, ISMIR 2024) | Conv + rotary transformer, 약 20M 파라미터, 체크포인트 약 78MB(`final0`–`final2`). 약 2M짜리 small 모델도 있다. beat와 downbeat를 함께 낸다. DBN 없이 50fps에서 ±70ms 안의 피크를 고른다. 30초 초과 파일은 **겹치지 않는 30초 청크로 나눠 이어 붙인다**. 그래서 청크 경계에서 위상이 틀어질 수 있다. https://github.com/CPJKU/beat_this, https://arxiv.org/abs/2407.21658 |
| 통합 모델 | **All-In-One** (Taejun Kim & Juhan Nam, WASPAA 2023) | 약 300K 파라미터 모델 하나가 Demucs 분리 음원을 입력받아 템포, beat, downbeat, 구간 경계, 기능 라벨을 모두 낸다. 후처리는 madmom DBN이다. https://github.com/mir-aidj/all-in-one, https://arxiv.org/abs/2307.16425 |
| 온라인(실시간) | **BeatNet** (ISMIR 2021) / BeatNet+ (TISMIR 2024) / **BEAST** (ICASSP 2024) | 인과적(causal) 모델이라 지연이 짧다. 파일 분석에는 오프라인 방식이 더 맞고, 온라인 방식은 downbeat 성능이 크게 떨어진다. BeatNet은 madmom이 필요하다. https://github.com/mjhydri/BeatNet |
| 곡 전체 템포 직접 추정 CNN | Essentia `TempoCNN` (Schreiber & Müller, ISMIR 2018) | 12초 구간을 6초 간격으로 보고 다수결로 정한다. `globalTempo`, `localTempo`, 확률을 반환한다. 공식 문서에서도 다수결은 템포가 일정할 때만 권장한다. https://essentia.upf.edu/reference/std_TempoCNN.html, https://github.com/hendriks73/tempo-cnn |
| 복수 템포 후보 | Essentia `RhythmExtractor2013` | 여러 BPM 가설과 각각의 강도를 반환한다. 화면에 후보를 보여줄 때 유용하다. |
| 2025–26 연구 | BeatFM (Ru et al., ICME 2025, MERT·MusicFM fine-tune) / "Beat tracking as object detection"(2025.10) / Masked-diffusion beat tracking (Foscarin·Korzeniowski·Vogl, ISMIR 2026) | BeatFM은 초안 단계이고 production용 가중치가 없다. object detection 방식은 기존과 비슷한 수준이다. masked-diffusion은 들쭉날쭉한 출력을 줄인다고 하지만 수치와 코드가 없다. 실무 기준 공개 SOTA는 여전히 Beat This!다. https://arxiv.org/abs/2508.09790, https://arxiv.org/abs/2510.14391, https://arxiv.org/abs/2608.04624 |

### 1.3 벤치마크 수치
**Beat This! vs Hung et al. 2022 (GTZAN held-out, 3 seed 평균)**
| 시스템 | Beat F1 | Beat CMLt | Beat AMLt | Downbeat F1 | DB CMLt | DB AMLt |
|---|---:|---:|---:|---:|---:|---:|
| Hung et al. 2022 (SpecTNT+TCN+DBN, 비공개) | 88.7 | 81.2 | 92.0 | 75.6 | 71.5 | 88.1 |
| Beat This! | **89.1±0.3** | 79.8±0.6 | 89.8±0.4 | **78.3±0.4** | 67.3±0.8 | 79.1±0.4 |

- F1은 이기지만 연속성은 진다. 논문 저자들은 어려운 곡에서 비주기적인 비트가 끼어든다고 설명한다. madmom DBN을 다시 붙이면 연속성 일부는 오르지만 F1은 내려간다.
- 8-fold 결과(beat/downbeat F1): Ballroom **97.5/95.3**, Harmonix **95.8/90.7**, Beatles **94.5/88.8**, Hainsworth 91.9 (Hung 87.7), **SMC 62.7** (Hung 60.5), ASAP 피아노 76.3/61.2, RWC Classical 77.1/66.3.
- MIREX 2025의 SMC F1 71.81은 SMC로 학습한 결과라서 일반화 성능이 아니다. 신뢰할 수치는 62.7이다.
- 다른 시스템:
  - KG-ApolloBeats의 GTZAN 92.53도 GTZAN으로 학습한 결과다. 공정 비교용 ApolloBeats 2는 88.21이다.
  - Yamaha BeatU는 자사 J-pop에서 F1 96.58, CMLt 94.46으로 강하지만 GTZAN 84.93, SMC 53.14로 약하다. 가중치는 공개되지 않았다.
  - MIREX 고전 베이스라인(QM Tempo Tracker)은 GTZAN F1 81.19, SMC 33.66이다.

**All-In-One (Harmonix 8-fold, 서구 팝으로 스튜디오 CCM에 가장 가까운 공개 기준)**
| | Beat F1 | CMLt | AMLt | DB F1 | DB CMLt | DB AMLt | 경계 HR.5F | 라벨 PWF | Sf |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All-In-One | **0.958** | 0.913 | 0.964 | **0.915** | 0.873 | 0.932 | **0.660** | **0.738** | 0.769 |
| TCN + demix | 0.946 | 0.898 | 0.950 | 0.894 | 0.850 | 0.919 | 0.619 | 0.715 | 0.738 |
- 음원 분리 입력을 빼면 네 과제 모두 성능이 크게 떨어진다.
- beat/downbeat/경계를 함께 학습하면 서로 성능이 오른다. 반면 구간 라벨 head는 downbeat 향상에 도움이 되지 않는다.

**BeatNet / BEAST (GTZAN)**
- Böck(madmom) 오프라인 beat/downbeat F1 79.09/51.36, BeatNet+DBN 80.64/54.07
- BeatNet 온라인: GTZAN 75.44/46.49, Ballroom 77.41/47.45
- BeatNet+ 온라인: GTZAN 80.62/56.51
- BEAST: 지연 46ms일 때 80.04/46.78, 743ms일 때 83.65/52.54

**곡 전체 템포 Acc1 / Acc2**
- Combined 세트: Schreiber CNN **74.2/92.1**, Böck(madmom) **69.5/93.6**, 2021 multi-scale 모델 **79.8/91.9**
- 데이터셋별 Acc1(Schreiber): Ballroom 92.0, GTZAN 69.4, GiantSteps 73.0, **SMC 33.6**
- 다른 표 기준: GTZAN Böck 69.7/95.0, Schreiber 69.4/92.6. Ballroom Böck 84.0/98.7, Schreiber 92.0/98.4.
- DeepSquare는 Ballroom Acc1 92.4%다.
- 출처: https://arxiv.org/pdf/2109.01607, https://arxiv.org/pdf/1903.10839
- **결론: 템포를 전혀 못 찾는 경우는 드물다. 주된 실패는 반/두 배 템포(octave error)다.** Acc1은 약 70~74%, Acc2는 약 92~95%다. Combined 기준으로 약 18%p가 ×2, ×3 허용 덕분에 정답이 된다.

### 1.4 함정과 대응
**(1) 반/두 배 템포 오류.** 느린 예배 발라드(60~75 BPM)에서 가장 큰 위험이다. 두 종류가 있다.
1. **박 단위(metrical level) 오류**: 박(tactus) 대신 더 작은 단위(tatum), 백비트, 마디 단위를 잡는 경우.
2. **클릭은 그대로인 half-time feel**: 스네어는 3박으로 옮겨가고 하이햇과 세분음은 원래 클릭을 유지한다. 스네어를 따르는 검출기는 절반을, 하이햇을 따르는 검출기는 클릭 템포나 그 두 배를 낸다.

관련 근거:
- 예배 드럼 레슨(Kari Jobe "Forever")은 메트로놈을 76으로 두고 같은 곡을 152로도 연습하라고 한다. 4분음표 클릭은 간격이 넓어 흔들리기 쉽기 때문이다. (https://www.worshipsolutions.com/how-to-play-drums-with-a-metronome)
- 2024년 예배 드럼 레슨은 half-time feel을 템포 변화가 아닌 일반적인 후렴 그루브로 다룬다.
- 일본 드러머는 half-time 필인을 60 BPM, 즉 느린 박 기준으로 표기한다. (X, 2026.07.27)
- X에서 DJ들은 Rekordbox가 두 배 템포로 잡는 것을 잘 알려진 현상으로 보고 손으로 ÷2 한다. 예: Grimes Coachella 2024 사례, @chairkicker "bpm ×2 had to half them one by one"(2026.05), @zakunuva "Rekordbox half-times my higher BPM stuff"(2025.04). Rekordbox에서 ×2, ÷2를 하면 ID3 메타데이터가 지워지는 문제도 있다. (@BillyLane, 2025.09)
- madmom DBN은 기본 `min_bpm=55`, `max_bpm=215`, `transition_lambda=100`이다. 그래서 40~50 BPM대 half-time 발라드는 허용 범위 밖이 되어 두 배로 올라간다. SMC 곡의 21%에서 두 배 템포를 강제해 실패했다. (https://arxiv.org/abs/2605.12287, 이 논문은 모델이 "자신 있게 틀린" 활성값을 낸다고 보고하고 다중 가설 추정을 권장한다.)
- madmom discussion #503: `min_bpm`, `max_bpm`을 실제 템포 근처로 좁혀도 두 배 비트가 남았다. 권장 조정은 템포가 정말 일정할 때 `transition_lambda`를 높이거나 활성값을 clip하는 것이다.
- Schreiber는 StackOverflow에서 146 BPM 곡이 73.5로 나온 사례에 librosa 전처리를 더하지 말고 TempoCNN이나 Essentia를 쓰라고 답했다.

**대응**
- 템포 = 60 / median(beat 간격). 드럼 없는 인트로를 빼고 안정적인 중간 구간(예: 가운데 60%, 또는 verse/chorus 구간)에서 계산한다.
- **항상 T/2, T, 2T를 후보로 둔다.** 간격 히스토그램 봉우리가 세 개면 ×3, ÷3도 넣는다.
- 장르 prior(예: 예배곡은 약 75 BPM 중심 log-normal, 55~160 범위)와 downbeat·박자 일관성, librosa tempogram 에너지를 함께 봐서 고른다. 점수가 비슷하면 UI에 대안을 보여준다.
- 사용자가 ×2, ÷2로 바꿀 수 있게 한다.
- 차트용 템포는 밴드가 메트로놈으로 쓸 박으로 정한다.
- half-time 플래그: 스네어/백비트 주기가 비트 주기의 약 2배이고 하이햇이 비트나 8분음표를 유지하면, "클릭 BPM + half-time feel"로 함께 보고한다. 76/152 레슨과 같은 방식이다.

**(2) 6/8, 12/8 박자.** 예배곡에 흔하다.
- 빠른 6/8은 2박(점4분음표)으로, 느린 6/8은 6박으로 세는 경우가 많다. (https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/)
- 이것은 반/두 배가 아닌 **3배 오류**다. Acc2는 이를 정답으로 봐주지만 차트 UI에서는 허용되면 안 된다.
- 예: 점4분 = 70이면 8분음표 = 210으로 madmom 상한 215 바로 아래다. 그래서 DBN은 점4분도 8분도 아닌 약 105를 고르거나 값이 잘린다.
- madmom `beats_per_bar=[3,4]`로는 "점4분 2박"을 표현할 수 없다. 2를 추가하면 상태 공간이 폭발한다(3+4만으로 약 26k HMM 상태, madmom #413).
- Beat This!는 박자 목록이 없어서 마디당 비트 수를 유연하게 낸다. Ballroom 3박 계열은 downbeat F1 95.3으로 잘 푼다. 하지만 하이햇이 8분음표마다 치는 느린 예배 6/8은 아직 풀리지 않았다.
- Skip That Beat 연구: 학습 데이터에 적은 박자는 성능이 떨어진다. (https://arxiv.org/pdf/2502.12972)
- DJ 사례: 5/4 212 BPM에서 4/4 169.6 BPM으로 넘어가는 전환(212 × 4/5)은 검출기 출력이 아니라 박자 변환 문제다. (@RamonPang, 2024.09)
- **대응**
  - downbeat 간격으로 마디 박 수(2/3/4/6)를 추정한다. 2박인데 8분음표 에너지가 강하면 BPM×3이 아닌 복합박자(2박으로 느낌)로 라벨링한다.
  - 복합박자는 점4분음표 BPM으로 보고한다. CCLI/SongSelect 관례와 맞추는 것인데, 이는 가정이므로 검증이 필요하다.
  - 박자를 확인하기 전에 [55, 215]나 4/4로 미리 제한하지 않는다.

**(3) 라이브 템포 드리프트, rubato.**
- madmom `transition_lambda`는 템포 변화에 지수 페널티를 준다. 클릭 트랙에서는 안정적이지만 연주가 빨라지면 실제 비트를 건너뛴다. Chiu et al.(TASLP 2023)은 완벽한 활성값을 줘도 madmom HMM이 느리고 안정적인 템포를 가정해 실제 피크를 무시한다는 것을 보였다. (https://mir.dei.uc.pt/pdf/Journals/MERGE/TASLP_2023_Chiu.pdf)
- Beat This!는 거의 일정한 템포를 가정하게 되므로 곡 전체 템포 head를 일부러 두지 않았다.
- Essentia는 템포가 일정하지 않으면 TempoCNN 다수결을 쓰지 말라고 한다. 대신 12초 단위 지역 추정값을 유지하고, 그 불일치 자체를 결과로 본다.
- librosa 유지관리자도 구간 전체가 빨라지거나 느려지는 곡에는 단일 템포가 맞지 않는다고 한다(dynamic beat 튜토리얼).
- 예배팀 실무:
  - 2년 전 78로 느끼던 곡이 지금은 85일 수 있다. (worshipchordbook.com/tools/bpm-tap)
  - 드럼 가이드는 클릭을 쫓지 말고 다음 downbeat에서 다시 맞추라고 한다. (worshiponline.com, 2026.04)
  - 드리프트는 정상이다.
- "마지막 후렴에서 +4 BPM" 같은 2024~26 정량 연구는 찾지 못했다.
- **대응**
  - 곡 하나의 BPM 대신 **지역 템포 곡선**을 보관한다(30초 청크 단위 median 간격, 그리고 구간 단위).
  - IQR이 약 3 BPM을 넘으면 "불안정" 플래그를 단다.
  - 신뢰도 = 같은 octave를 가리키는 지역 윈도우의 비율 + beat 간격 변동계수(CV).
  - SMC 같은 소재는 128.00처럼 확신 있는 숫자가 아니라 "불안정"으로 반환해야 한다.
- **구간별 템포**: 마지막 후렴의 key change는 비트 주기를 바꾸지 않는다. 대신 편곡 밀도가 바뀌고, half/double feel은 바로 그 지점에서 뒤집히기 쉽다. 그래서 경계를 구한 뒤 구간별로 템포를 계산한다.

**(4) 드럼 없는 인트로 (패드/피아노 + 보컬).**
- 활성값이 약해 SMC 같은 실패가 난다. 드럼 없는 인트로, 회중 소음, rubato 피아노에서 기대할 수 있는 상한은 SMC 수준(beat F1 약 63, downbeat 약 61)이고, Harmonix의 0.96이 아니다.
- 대응: 확신도가 높은 full-band 구간의 비트로 곡 전체 BPM을 계산한다(All-In-One 구간 활용 가능). 인트로와 아웃트로는 제외한다.

**(5) 데이터 주의.**
- 예배, 회중, 라이브 믹스 데이터셋은 없다.
- GTZAN은 라벨 오류가 있다(`jazz.00000`, `jazz.00002`, `blues.00015` 등). Foscarin et al.이 수정 라벨을 공개했다. (https://github.com/CPJKU/beat_this_annotations)
- 2026년부터 MIREX는 GTZAN 학습을 금지한다. GTZAN F1만 내세우는 모델, 특히 GTZAN으로 학습한 결과는 교체할 이유가 되지 않는다.

### 1.5 라이선스와 설치
| 패키지 | 라이선스 | 상태 |
|---|---|---|
| **Beat This!** | **코드·가중치 모두 MIT** | `pip install beat-this`, PyTorch ≥2.0, CPU·GPU 모두 동작. `--dbn` 옵션은 madmom을 끌어오므로 피한다. |
| madmom | 코드 BSD, **모델·데이터 CC BY-NC-SA 4.0 (비상업)** | 상업적으로 쓰려면 JKU(Gerhard Widmer) 라이선스가 필요하다. PyPI는 0.16.1(2018.11, sdist만)에서 멈췄고 Python ≥3.10, NumPy ≥1.24에서 깨진다. `pip install git+https://github.com/CPJKU/madmom`(0.17.dev)으로 우회한다. 2025년 PR #542 등 활동은 있다. 60초 파일 beat tracking에 CPU 1개로 약 9.6초(issue #403). |
| All-In-One | 코드 MIT | madmom(git), NATTEN(빌드가 어렵고 Windows는 소스 빌드), demucs, PyTorch가 필요하다. CPU에서 가장 무겁다(곡당 수십 초로 추정, 미검증). 2026년 재패키지 `all-in-one-infer`가 있다. |
| BeatNet | CC BY 4.0 | madmom 필요 |
| Essentia / TempoCNN | 라이브러리 **AGPL**, TempoCNN 모델 **CC BY-NC-SA 4.0** | 상업적으로 쓰려면 별도 라이선스가 필요하다. |
| librosa | ISC | wheel 제공, 유지관리 활발. 기준선·보조용으로 안전하다. 0.10.2부터 tempo를 길이 1 배열로 반환해 기존 스크립트가 깨졌다(#1867). |

### 1.6 X에서 본 실무 동향
| 누가 | 무엇을 신뢰하나 |
|---|---|
| @deepfates (2024.10, 좋아요 약 2.4k) | Replicate의 All-In-One 하나로 stem 분리, BPM, verse/chorus를 한 번에 처리 |
| @RubenHorbach (2026.09.27) | Demucs → Whisper → librosa 비트 그리드(129 BPM)로 영상 컷을 비트에 맞춤. 정확도 증거가 아니라 "사람들이 무엇을 쓰는가"의 증거다. |
| @jmacftw (2026.09.27) | DSP 먼저(스펙트로그램, 크로마, 라우드니스, **템포와 key에 불확실성 플래그**), LLM은 설명에만 사용. "None of that takes a model call." |
| DJ들 (2024–2026) | Rekordbox는 두 배나 절반으로 잡는다. 손으로 ÷2, ×2 하고, 템포가 변하는 곡은 sync를 끈다. |
| @MireloAI (2026.07) | 상용 audio-to-MIDI는 코드, key, 템포를 결과물이 아니라 맥락 정보로 쓴다. |
| 실무 공통 | 동기화할 BPM 하나를 원하지만 반/두 배로 틀릴 것을 알고 손으로 고친다. |
- Tunebat BPM에 대한 불만도 있다: "how tunebat feels giving me the wrong bpm", 일본 프로듀서의 "Tunebat BPM은 거짓말이고 위험하다".

### 1.7 BPM 권장 파이프라인
**라이선스 제약이 없고 스튜디오 CCM인 경우 (Grok 안)**
1. All-In-One으로 경계, 라벨, beat, downbeat를 구한다.
2. 같은 파일에 TempoCNN 지역 투표를 돌린다. median 간격과 TempoCNN 다수결이 약 2배나 3배 차이 나면 둘 다 보여주고 자동으로 고르지 않는다. **TempoCNN은 NC 라이선스라서 상업적으로는 쓸 수 없다.**
3. 선택: Beat This! `--dbn`을 연속성 점검용으로만 돌린다. DBN 그리드와 원래 그리드가 갈라지면 그 곡은 DBN 가정 밖이므로 원래 그리드를 유지한다.

**라이브, 드럼 없는 인트로, 즉흥 후렴, 템포 푸시가 있는 경우 (공통 권장)**
1. ffmpeg로 22.05 또는 44.1kHz 모노로 디코딩한다.
2. **Beat This!** `final0`를 **DBN 없이** 돌려 beat와 downbeat를 구한다.
3. 템포 곡선 = 30초 청크별, 그리고 구간별 median 간격. 파일 전체 다수결은 쓰지 않는다.
4. 신뢰도 = 같은 octave 윈도우 비율 + 간격 CV.
5. 박자 = downbeat 간격(2/3/4/6)의 최빈값. 복합박자는 점4분 BPM으로 보고한다.
6. octave 판정: {T/2, T, 2T}를 장르 prior와 tempogram으로 채점한다. 점수가 비슷하면 대안도 반환한다.
7. half-time 플래그를 붙인다.
8. librosa 기본 `beat_track`을 저장값의 근거로 쓰지 않는다. tempogram 시각화용으로는 괜찮다.
9. 구간 라벨은 "4비트마다 한 번" 같은 규칙이 아니라 구조 모델에서 가져온다. downbeat F1은 모든 시스템에서 약한 지표다(GTZAN 오프라인 70대 후반, 온라인 40대 후반).
10. 예배곡 30~50곡(스튜디오와 라이브 반반)을 라벨링하고 `mir_eval`로 Acc1, Acc2, beat F1을 측정해 prior를 조정한다.

---

## 2. Key (전조 포함)

### 2.1 곡 전체 key 하나로는 전조를 놓친다
- 표준 파이프라인: 스펙트럼 → 12음 크로마(HPCP) → **파일 전체 평균** → 24개 템플릿과 상관을 계산한다.
- Korzeniowski & Widmer: 단일 key는 "전조가 있는 곡에 대응하지 못한다". (https://ar5iv.labs.arxiv.org/html/1706.02921)
- Essentia `Key`는 HPCP의 평균을 계산한다. 곡의 1/4짜리 마지막 후렴은 훨씬 크게 연주되지 않는 한 평균에서 이길 수 없다. 반대로 크게 연주되면 올라간 key가 "곡의 key"가 되고 verse key가 사라진다.
- DJ 소프트웨어 개발자 Yannick Feige(X, 2026.06): 7분짜리 곡에는 key가 하나가 아니다. "best you get is where it mostly lives"이고, 리버브와 에코가 크로마를 더 번지게 한다.
- **설계에서 피해야 할 실패는 무작위로 틀린 key가 아니다.** verse나 마지막 후렴 중 하나만 골라 확신하고 나머지를 버리는 것이다.

**다뤄야 할 전조 유형**
1. **마지막 후렴 key up ("truck driver's gear change")**: 코드 진행은 같고 tonic만 +1, 때로 +2 반음 오른다. 보통 피벗 없이 올라가서 돌아오지 않는다. 팝과 CCM에서 가장 흔한 유형이다. 곡의 마지막 40% 구간에 +1/+2 점프 prior를 두는 것이 타당하다. (https://tvtropes.org/pmwiki/pmwiki.php/Main/TruckDriversGearChange)
2. **돌아오는 구간 전조**: verse는 한 key, chorus는 온음이나 단3도 위였다가 다시 돌아온다. 예: "We Are the Champions"(Eb verse, F chorus, Eb 복귀). 끝부분 변화점 하나만 찾는 방식은 이것을 놓친다.
3. **전조가 아닌 경우**: axis 진행(C–G–Am–F, Am–F–C–G)은 계속 같은 일곱 음을 쓴다. 여기서 전조를 보고하면 관계조 오류다.

### 2.2 평가 지표
- MIREX weighted score(2025 과제에서도 동일): 정답 1.0, 5도 0.5, 관계조 0.3, 같은 으뜸음조 0.2, 그 외 0. (https://www.music-ir.org/mirex/wiki/2025:Audio_Key_Detection, mir_eval `key.py`)
- "85%"라는 헤드라인은 코드 차트를 망치는 바로 그 실수들을 가릴 수 있다.

### 2.3 Key profile (템플릿) 방식
- 12개 가중치를 12개 tonic × 장·단조로 회전시키고, 상관이 가장 높은 것을 고른다.
- **Krumhansl–Kessler (1982)**: probe-tone 청취 실험에서 나왔다.
  - C장조: `6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88`
  - C단조: `6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17`
  - Essentia는 "팝에 대체로 잘 맞는다"고 설명한다.
  - 단조 profile에서 b7이 이끔음보다 높아 C단조가 Eb장조처럼 보인다(Temperley 지적).
  - 2021 연구: Krumhansl 장조 profile은 록 청취자보다 클래식 청취자에 더 잘 맞는다.
- **Temperley (1999)**: 코퍼스에서 뽑은 대체 profile이다. 짧은 구간 안에서 음이 있는지 없는지만 세고, **구간 간 key 변경에 페널티**를 준다. 템플릿 방식의 전조 추적에 해당한다.
  - 장조: `5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0`
  - 단조: `5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0`
  - 클래식(특히 단조)에서 가장 좋다. MIREX 2005 클래식 세트에서 Essentia+Temperley는 정답 0.634, weighted 0.761이었다(Cannam/Noland 0.827/0.868에 뒤짐).
- **EDMA / EDMM / bgate (Faraldo et al. 2017)**: 인지 기반 profile이 아니다.
  - EDMA: EDM 코퍼스의 중앙값 profile
  - EDMM: EDMA를 손봐서 **장조를 단조로 보고하도록** 만든 것. EDM 대부분이 단조라서다.
  - bgate: Beatport 중앙값에서 가장 약한 4개 bin을 0으로 만든 것
  - MIREX weighted 점수:

    | Profile | GiantSteps | Beatport | Shaath |
    |---|---|---|---|
    | Essentia baseline | 0.448 | 0.453 | 0.467 |
    | edma | 0.673 | 0.636 | 0.688 |
    | edmm | 0.720 | 0.638 | 0.767 |
    | bgate | 0.725 | 0.734 | 0.741 |

  - GiantSteps 정답률: edma 0.581, edmm 0.642, bgate 0.641, KeyFinder 0.604, **Mixed In Key 0.672**
  - Beatport 정답률: KeyFinder 0.548, MIK 0.657, bgate 0.637
  - Shaath 정답률: KeyFinder 0.674, MIK 0.720, bgate 0.663
  - 결론: 장르에 맞춘 알고리즘이 범용 알고리즘을 이긴다. 조성 관행이 장르마다 다르기 때문이다.
- **Shaath**: Krumhansl을 팝·전자음악에 맞게 바꾼 profile로, 오픈소스 KeyFinder가 쓴다.
- Essentia `profileType` 옵션: `diatonic, krumhansl, temperley, weichai, tonictriad, temperley2005, thpcp, shaath, gomez, noland, edmm, edma, bgate, braw`
- ⚠️ **Essentia 기본값은 `bgate`, 즉 EDM profile이다. `edmm`은 일부러 단조로 보고한다. 예배/팝에는 `krumhansl`이나 `temperley`로 설정해야 한다.**

### 2.4 CNN 기반 곡 전체 key 모델
- **Korzeniowski & Widmer 2017 (ConvKey)**
  - 입력: 로그주파수 스펙트로그램(5fps, 8192 프레임, 65Hz–2.1kHz, 옥타브당 24밴드) → conv 5층 → global average → 24-way softmax
  - 같은 장르로 학습하면 GiantSteps 74.3(EDMM 70.1), Billboard 83.9(78.7)
  - 팝으로 학습한 모델을 EDM에 적용하면 57.3. 두 장르를 한 모델로 학습하면 EDM 69.2, 팝 79.7
  - 장르를 넘나들 때의 오류는 주로 관계조와 같은 으뜸음조 혼동이다. RNN 층을 추가해도 단순 평균을 이기지 못했다.
- **2018 AllConv (madmom이 실제로 탑재한 모델)**
  - 무작위 20초 조각으로 학습했다. 클래식은 전조 때문에 앞 30초만 썼다.
  - 장르 무관 모델 하나의 결과:

    | 세트 | Weighted | 정답 | 5도 | 관계조 | 같은 으뜸음조 | 기타 |
    |---|---|---|---|---|---|---|
    | GiantSteps | 74.6 | 67.9 | 7.0 | 8.1 | 4.1 | 12.9 |
    | Billboard | 85.1 | 79.9 | 5.6 | 4.2 | 6.2 | 4.2 |
    | 클래식 | 96.6 | 95.2 | 1.4 | 1.4 | 1.4 | 0.7 |

  - 클래식 수치는 전조 성능이 아니다(앞 30초만 사용, key는 곡 제목에서 가져옴). 논문도 "tracking key modulations is left for future work"라고 적었다.
  - 다른 장르로 특화 학습하면 크게 나빠진다: CK1은 Billboard 72.8, 클래식 BD1은 GiantSteps 59.6.
  - 짧은 발췌는 전체 곡보다 나쁘다. 모델이 구간 전체의 화성적 일관성을 봐야 하기 때문이다.
  - `madmom.features.key.CNNKeyRecognitionProcessor`: 앙상블로 24개 클래스 확률을 반환한다. **곡 전체 추정기라서 전조를 보려면 구간 단위로 돌려야 한다.**
- **Schreiber & Müller key-cnn 2019**
  - DeepSquare는 GTZAN Key 정답률 약 49.9%다(엄격 기준, 라벨이 지저분한 세트라 위 수치들과 비교 불가).
  - `keygram` 도구는 **프레임별 key 확률**(CSV/PNG)을 출력해 전조 파악에 쓸 수 있다. (https://github.com/hendriks73/key-cnn)
- **최신 GiantSteps 비교 (MIREX weighted)**
  - KeyFinder 59.3 · ConvKey 74.3 · AllConv 74.6 · InceptionKeyNet 75.7(가중치 비공개) · MERT-95M probe 73.0 · **KeyMyna(2026) 75.9, 현재 SOTA**
  - Billboard: AllConv 85.1, KeyMyna 84.4
  - KeyMyna: GitHub 코드만 있고 PyPI 없음, 마지막 push 2025.02, **라이선스 미표기**. (https://arxiv.org/abs/2604.10021, github.com/echo-cipher/keymyna)
- **MusicalKeyCNN 재구현 (GiantSteps, weighted/정답)**
  - keynet.pt 73.51/66.72, **Mixed In Key 8.3 75.70/69.37**, Rekordbox 7.12 65.53/56.79
  - CNN과 MIK, Rekordbox를 가장 깔끔하게 비교한 공개 자료다(단 EDM). (https://github.com/a1ex90/MusicalKeyCNN)
- 요약: EDM에서는 딥러닝이 템플릿보다 약 15점 높다. 화성이 명확한 팝·예배곡에서는 격차가 훨씬 작다.
- 데이터셋: GiantSteps Key(테스트 604곡), GiantSteps MTG Key(학습 1,486곡), McGill Billboard key subset(625곡), GTZAN key 라벨. MIREX 2025 과제 페이지는 있지만 2024·2025 결과표는 공개된 것을 찾지 못했다.
- **기대 정확도**: 잘 구현하면 깨끗한 단일 key 스튜디오 예배곡에서 **정답 약 80%, weighted 약 85%**다(Billboard CNN 수준). 오류는 관계조, 같은 으뜸음조, 5도에 몰린다. EDM에서는 정답 약 68%로 떨어진다. 마지막 후렴 key up이 있는 라이브 녹음에 대한 수치는 아무도 발표하지 않았다.

### 2.5 Local key와 전조 추적
- **Windowed key + HMM/Viterbi**
  - 상태 24개. emission은 8~30초 윈도우의 템플릿 상관이나 CNN 확률이다.
  - 전이 행렬은 자기 전이를 강하게 두고, 5도권 가중치를 준 작은 점프를 허용한다.
  - 곡 전체 key 추정보다 연구가 훨씬 적다.
- **Schreiber, Weiß, Müller (ICASSP 2020)**
  - Schubert 《겨울나그네》 9개 연주, 전문가 3명이 주석
  - 처음 보는 곡에서 HMM과 CNN 모두 약 70% 프레임 정확도(song split HMM 69 / CNN 72, neither split 71 / 73)
  - 같은 곡을 다른 녹음으로 본 적이 있으면 CNN은 약 96%다. 진행을 외운 것이라 "cover-song 효과"라고 부른다.
  - 남은 오류 상당수는 주석자끼리도 의견이 갈린 곳이거나 5도·관계조였다.
- **Ding & Weiß, OctaveNet (EUSIPCO 2024)**: CQT를 옥타브·음높이 단위로 재배열하고 작은 conv + BiLSTM을 쓴다(약 150k 파라미터, 20초 학습).
  | 모델 | version split | song split | neither split |
  |---|---|---|---|
  | HMM | 76 | 67 | 71 |
  | CNN | 95 | 71 | 73 |
  | OctaveNet | 96.23 | **80.00** | **77.75** |
  - 여전히 피아노와 성악 가곡 24곡이라 라이브 밴드와는 거리가 멀다.
- **Gedizlioğlu & Erol (Musicae Scientiae, 2024.04)**
  - 여러 장르 80곡에서 regularization 방법이 MIREX 평균 **0.899**, HMM이 **0.826**이었다.
  - HMM은 80곡 중 41곡에서 완벽했지만 나머지 상당수에서 크게 틀렸다. 한 마디의 잘못된 key가 다음으로 전파되기 때문이다.
  - **"key를 유지하라"는 prior가 강하면 verse는 안정되지만, 후렴 한 번만 지속되는 전조를 뭉개거나 삼킨다.** (https://journals.sagepub.com/doi/10.1177/10298649241245075)
- 2024~26 기간에 CCM, 라이브, truck-driver 전조를 다룬 공개 벤치마크는 없다. 《겨울나그네》의 80%를 Hillsong 라이브에 그대로 옮기는 것은 추측이다.
- **반복 구간 전조 비교 (Optimal Transposition Index, OTI)**: 예배곡의 "마지막 후렴 한 단 올리기"에 가장 잘 맞는 방법이다.
  - cover-song 식별 기법이다. 구간 B의 크로마를 k = 0..11 반음 순환 이동시켜 구간 A와 상관이 최대인 k를 고른다.
  - 또는 전조 불변 self-similarity matrix(Müller)를 쓰면 반복 후렴이 k = +1, +2 대각선에 나타난다.
  - Essentia `ChromaCrossSimilarity(oti=True)`
  - 출처: https://mtg.github.io/essentia-labs/news/2019/09/05/cover-song-similarity/, http://mtg.upf.edu/system/files/projectsweb/jserra10coveridreview.pdf
- **구간 단위 결정 (Grok 권장)**: 프레임 단위로 추적하지 말고 **편곡 구간마다 key를 하나씩** 정한다. 다음 안정 구간이 +1이나 +2 반음 위이고 그 구간의 strength도 높을 때만 변화로 본다. 《겨울나그네》식 프레임 추적보다 truck-driver 형식에 잘 맞는다.

### 2.6 코드 인식 (보조 수단)
- 코드 인식은 key 모델 자체가 아니라 **전조 시점 파악과 관계조 판별**에 쓴다. 2017년 기준 key·코드 결합 시스템은 MIREX에서 전용 key 시스템에 졌다. 하지만 key profile은 진행이 새 tonic으로 해결되기 시작했다는 것을 보지 못하므로 코드가 필요하다.
- **Chordino / NNLS Chroma** (Mauch & Dixon, 2010): Vamp 플러그인이고 **GPL-2+**다. Python `vamp` 패키지로 호출할 수 있다. NNLS로 대략적인 음 전사를 먼저 해서 기음과 배음 혼동을 줄인다. MIREX 2009 코드 세트에서 약 80%(이전 최고 74%). 출력은 key가 아니라 코드열이다. (https://github.com/c4dm/nnls-chroma)
- **BTC** (Park et al., ISMIR 2019): 양방향 Transformer, **MIT**, 마지막 업데이트 2020.
  - 장·단 어휘: root 83.8±1.0, maj-min 82.7±1.0
  - 대어휘(170 라벨): triads 75.9, sevenths 71.8, MIREX 80.8
  - CNN+CRF가 일부 maj-min 지표에서 앞섰다(83.1).
  - 2026년 USPop 재평가: BTC maj-min 0.763, root 0.820, CRNN 0.780, Mamba 기반 BMACE 0.768
  - 2025 BTC 변형(BTC-FDAA-FGF)은 +1.2~2.2점 향상을 주장한다.
  - https://github.com/jayg996/BTC-ISMIR19
- **ChordFormer** (2025): conformer 구조, 대어휘. (https://arxiv.org/abs/2502.11840)
- **autochord**: 2021년 0.1.4가 마지막으로 사실상 방치됐다.
- 스튜디오 팝에서 프레임 코드 정확도가 80% 초반이면 몇 마디마다 한 번씩 틀린다는 뜻이다. G에서 Ab으로 tonic이 이동해 머무는 것을 보기에는 충분하지만, 리허설 없이 차트로 인쇄하기에는 부족하다.
- **코드열에서 key를 줄여내는 방법**
  - 구간 안 코드 root를 길이로 가중해 히스토그램을 만들고 diatonic 집합과 비교해 점수를 낸다.
  - 동점이면 프레이즈가 끝나는 코드를 고른다. (WorshipChordBook 권장)
  - 전조는 차용 코드 하나가 아니라 **새 tonic이 유지되는 것**이다. 부속화음(G 안의 D장조)이 key를 뒤집으면 안 된다. Temperley의 변경 페널티와 HMM 자기 전이가 이 때문에 있다.
  - 단조와 나란한조를 가르는 단서는 5도 위 **장3화음**이다. 예: A단조의 E/E7에 있는 G#은 C장조에 없는 음이다.

### 2.7 함정
- **관계조와 5도 혼동이 주된 오류다.**
  - C장조와 A단조는 같은 일곱 음을 쓴다.
  - AllConv 관계조 오류: Billboard 4.2%, GiantSteps 8.1%. 같은 으뜸음조 오류: Billboard 6.2%.
  - Feige: 관계조는 Camelot 번호가 같고 문자만 다르다(8A vs 8B). "software mixes them up all the time." 5도가 강하면 C장조를 G로 잡는다("wrong, but close enough that nothing screams").
  - @pburghdoom(2026.09.24): 5도 관계 key들의 음높이 히스토그램은 7음 중 6음을 공유해 이미 **상관 0.50**이다. (그의 "99%"는 기호 기반 다음 음 예측 모델의 은닉 상태를 선형으로 읽은 값으로, 오디오 key 정확도가 아니다.)
  - 관계조는 베이스 음이나 마지막 코드로 판별한다.
  - Essentia는 `strength`와 `firstToSecondRelativeStrength`를 반환한다. 두 값이 가까우면 "G major, or E minor"처럼 두 후보를 반환하는 것이 정직하다.
- **선법**: Dorian vamp나 Mixolydian bVII 같은 예배곡 작법에서 24개 장·단조 클래스는 parent key를 고른다. Essentia와 madmom 모두 Dorian 클래스가 없다.
- **튜닝 오프셋 (A≠440)**
  - 먼저 `librosa.estimate_tuning`이나 Essentia `TuningFrequency` / HPCP `referenceFrequency`로 추정하고, 그 기준으로 크로마를 만든다. 그러지 않으면 1/4음 어긋난 녹음이 bin 사이로 번진다.
  - Essentia `KeyExtractor` 기본 `hpcpSize`는 12다. 평균 디튜닝 보정은 12보다 클 때만 동작하므로 **라이브 녹음이나 A440보다 높게 튜닝된 곡은 36 bin + `averageDetuningCorrection`**을 쓴다. (https://essentia.upf.edu/reference/streaming_KeyExtractor.html)
- **저음이 표를 과하게 가져간다**: 킥, 베이스, 서브가 크로마를 지배한다. 라이브 드럼도 마찬가지다. 크로마를 뽑기 전에 high-pass나 HPSS를 걸거나, 코드 모델의 베이스·화성 분리를 더 믿는다.
- **드럼과 보컬이 크로마를 번지게 한다.** APSIPA 2025 논문은 htdemucs로 드럼을 뺀 믹스, 드럼과 보컬을 뺀 믹스, 베이스 stem을 분석해 코드 인식을 개선했다. key에는 **"other + bass"만 넣는 것이 저렴하고 근거도 있다.** Demucs 4.1.0은 PyPI에 있다(MIT, 2026.07). (http://www.apsipa.org/proceedings/2025/papers/APSIPA2025_P307.pdf)
- **말소리, 회중, 인도 멘트**: 목사님 인트로나 회중 소리는 비화성 에너지라 `strength`를 희석한다. 음악이 아닌 구간은 key 추정 전에 잘라낸다. 구조 분할은 key 추정에도 도움이 된다.
- **패드와 디스토션 기타**: AudioCipher 테스트에서 Tunebat은 앰비언트 패드와 솔로 라인에서 실패하고, 빽빽하게 퀀타이즈된 믹스에서는 나았다. 피아노+보컬 verse와 풀밴드 chorus는 따로 추정해야 한다.
- **짧은 구간**: 2018 CNN은 20초 조각으로 학습했는데도 짧은 발췌에서 성능이 떨어졌다. 8초짜리 turnaround는 key를 믿을 만한 윈도우가 아니다. 구간 전체를 모으거나 모든 chorus를 합쳐서 추정한다.
- **짧은 윈도우는 결과가 흔들린다**: 변화가 약 8마디 이상 유지되고 반복 구간의 OTI로 확인될 때만 인정한다.
- **자기 전이와 key up의 충돌**: HMM이나 높은 변경 페널티는 verse를 안정시키지만 한 후렴짜리 전조를 놓친다. 메모리 없는 프레임 분류기는 깜빡인다. 그래서 구간 단위로 결정한다.
- **카포, 남녀 key, "차트 key"**: 검출기는 녹음된 소리를 듣는다. 카포를 쓴 G 차트나 여성 key로 내린 곡은 다른 숫자가 된다. 피아노 중심 예배곡은 Bb, Eb, Ab이 많은데, 기타는 카포로 옮긴다(WorshipChordBook). **오디오 key를 보고하고, 전조(transpose)는 별도 단계로 둔다.**
- **같은 곡의 다른 믹스로 학습하고 일반화라 부르지 말 것**: 《겨울나그네》 CNN은 새 곡 약 72%에서 본 곡의 새 녹음 약 96%로 뛰었다. 스튜디오 믹스로 학습한 곡의 라이브 버전을 테스트하면 결과가 부풀려진다.

### 2.8 상용 도구와 X 반응
- **Mixed In Key**: 라이선스받은 tONaRT 엔진 + 자체 특허 알고리즘, 비공개, key 하나만 출력한다. DJ들이 서로 추천하는 도구지만 단독으로 믿지는 않는다.
  - DJ ENDO(Berklee Online 강사, 2025.08): 피아노로 수천 곡을 확인했더니 "Mixed in key is by far the best", 다른 프로그램들은 놀랄 만큼 부정확했다.
  - 프로듀서 MATIRAMIC: "Even when using Mixed In Key, I will always recommend double-checking."
  - 98Patrobas(2025.11): Serato와 Rekordbox의 key 분석은 VirtualDJ보다 못하다. 아니면 MIK를 사거나 귀로 찾는다.
  - Feige: 같은 파일이 Rekordbox, Serato, MIK에서 세 가지 key로 나올 수 있고, 그게 버그 세 개라는 뜻은 아니다.
  - 수치(편향 표시):
    - Faraldo 2017 EDM: MIK 정답 GiantSteps 67.2%, Beatport 65.7%, Shaath 72.0%
    - MusicalKeyCNN: MIK 8.3 69.37%/75.70
    - Crossfader(2024.12, **MIK 후원**): 200곡 이상에서 MIK 11, Rekordbox, Serato가 일치한 비율은 39%. Serato는 MIK와 45%, Rekordbox는 38% 달랐다. 이는 정확도가 아니라 **불일치** 측정이다.
    - Freqblog(2026.04): 같은 39/45/38 수치를 반복한 것으로 새 연구가 아니다.
    - Dubspot(2026.05, 업계 근접 lab 노트): 200곡 중 MIK 11 178곡(89%), KeyFinder 76%, Rekordbox 7 69%, Beatport 저장 key 60%. 장르별로 댄스 94%, 팝 90%, 힙합 87%, 재즈·소울 80%(전조, 확장 화성, rubato 때문).
    - Magnetic Magazine(2025.01): "almost always" 맞았고 가끔 손으로 고쳤다.
- **Tunebat**: DB 조회와 대략적인 추정기를 섞은 서비스다.
  - DB가 Spotify Audio Features 기반인데 **2024.11.27 Spotify API가 종료**되어 그 시점 값으로 멈췄다. 분석기 결과와 DB가 다를 수 있다.
  - Reddit DJ 비교(2021): Tunebat 37~48%, Spotify 15~39%, MIK 74~86%
  - Parrser(2026): Spotify 기반 정확도 약 38%, 주로 관계조 혼동
  - AudioCipher(2023): 대표적 실패는 **5도**(B minor → F minor, C minor → G minor)
- **Chordify**: 2024~26 정확도 표가 없다. X의 베이시스트: "chordify is wrong a lot so i have to figure it out by ear." transpose UI가 감지된 key 전체를 한 반음 옮기므로, 검출기가 두 key를 평균 내버렸다면 transpose 후 key up이 사라진다.
- **Moises**: stem 분리 후 AI로 key·코드를 검출하고 피치 시프터를 제공한다. 전조 검출은 언급이 없다. 정량 연구도 없다(X에서 "Moises key"를 검색하면 축구선수 Moisés Caicedo가 대부분이다). AudioCipher(2023.10) 소규모 테스트에서는 "대부분 정확"했다. key 필드를 기능의 근거로 삼지 말 것.
- **Spotify** `audio-features`/`audio-analysis`: key, mode, 구간별 key를 제공했지만 2024.11.27부터 신규 앱에 403을 반환한다.
- **LLM의 key 답변은 DSP보다 못하다**: 한 음악가는 Google AI overview가 "100% 틀린다"고 했다(2026.08). @jmacftw처럼 DSP로 계산하고 불확실성을 허용한 뒤, 그 위에서 LLM에 질문만 하는 구조가 맞다.

### 2.9 라이선스와 설치
| 패키지 | 상태 | 라이선스 |
|---|---|---|
| essentia | 2.1b6.dev1438, wheel 2026.05, 저장소 2026.09까지 활동 | **AGPL-3.0** (비공개 서비스·SaaS에 문제) |
| madmom | PyPI 0.16.1(2018), Python ≥3.10에서 깨짐. GitHub main은 2026.03까지 커밋, git 설치 필요 | 코드 BSD, **모델 CC BY-NC-SA** |
| librosa | 1.0.0 (2026.08), Python ≥3.12 | ISC |
| demucs | 4.1.0 | MIT |
| KeyMyna | GitHub만, 마지막 push 2025.02 | 미표기 |
| BTC | 2020 이후 업데이트 없음 | MIT |
| Chordino | Vamp 플러그인 | GPL-2+ |
| music21 | 10.5 | BSD (기호 음악 전용) |

### 2.10 Key 권장 파이프라인 (두 조사 통합)
1. **음원 분리**: htdemucs로 bass+other만 남긴다(드럼, 보컬 제거).
2. **튜닝 추정**: 화성 stem에 `librosa.estimate_tuning`.
3. **특징**: 튜닝 보정한 beat 동기 CQT 크로마(librosa).
4. **먼저 구간 분할**: key와 코드는 파일 전체가 아니라 **구간 안에서만** 계산한다.
5. **구간별 key 추정**
   - Krumhansl 또는 Temperley profile. AGPL을 받아들일 수 있으면 Essentia `Key`(`profileType=krumhansl`, `hpcpSize=36`, 디튜닝 보정 on). 아니면 numpy로 약 20줄이면 된다.
   - 대안: 슬라이딩 윈도우(8~16비트) + Viterbi(자기 전이 약 0.99, 같은 선법 ±1/±2 반음 점프에 작은 보너스)
   - 교차 확인: madmom CNN(**비상업만**)이나 KeyMyna(라이선스 미표기)
6. **코드 모델**: BTC(MIT)나 Chordino(GPL). 두 추정기가 관계조나 같은 으뜸음조 쌍으로 갈리면 코드 집계(프레이즈 마지막 코드, 단조를 고를 때는 장3화음 V)로 판정한다. `firstToSecondRelativeStrength`가 낮으면 두 라벨을 모두 반환한다.
7. **전조 판정**: 뒤 구간의 tonic이 앞 구간보다 **1~2반음 높고**, 두 구간 모두 strength가 높고, 새 tonic이 구간 끝까지 유지되고, **반복 후렴의 OTI(첫 등장 대비 +1/+2)가 일치**할 때만 전조로 본다. 시점은 가장 가까운 downbeat나 구간 경계에 맞춘다.
   - 새 음이 없는 관계조 전환은 전조로 보지 않는다.
   - 돌아오는 구간 전조(verse와 chorus의 key가 다른 경우)도 구간 단위로 잡는다.
8. **출력**: 첫 key를 곡의 key로 두고 변화를 붙인다. 예: `G major (0:00–3:12) → Ab major (3:12–end)` 또는 "G major, last chorus Ab major".
9. 5도 관계 차순위가 가까우면 항상 함께 보여준다.
10. Tunebat이나 Spotify 카탈로그 key를 정답으로 쓰지 않는다. LLM에게 key를 맞히게 하지 않는다.
- **생략한 것**: local key 모델 자체 학습. 템플릿 + Viterbi/구간 판정 + OTI 확인으로 diatonic 예배곡은 충분할 것으로 본다. 예배곡 수십 곡으로 검증했을 때 템플릿이 실패하면 그때 검토한다.

---

## 3. Arrangement (곡 구조)

### 3.1 평가 지표
| 지표 | 의미 | 2025~26 기준 좋은 값 |
|---|---|---|
| **HR.5F** | 경계가 **0.5초** 안에 맞은 F-measure | 최고 **0.703** |
| **HR3F** | **3초** 안 기준 | 보통 0.78~0.85. downbeat에 맞아야 하는 차트용으로는 너무 느슨하다. |
| **ACC** | **기능 라벨**이 맞은 시간 비율(프레임 단위) | 최고 0.807(영어 팝), 0.891(중국어) |
- `mir_eval.segment`
  - `detection`: HR.5F, HR3F
  - `deviation`: 경계 오차 중앙값
  - `pairwise`, `nce`, `vmeasure`: 0.1초 프레임 라벨 일치도
  - 공통 어휘로 매핑한 뒤 ACC를 추가로 계산한다.
  - https://mir-eval.readthedocs.io/latest/api/segment.html
- HR.5F가 0.70이어도 경계 10개 중 3개는 0.5초 넘게 어긋난다. 4분짜리 곡이면 음악 감독이 손으로 옮겨야 할 구간이 여러 개다.
- **정확도 숫자 하나만 인용하지 말 것**: 0.660, 0.596, 0.703은 서로 다른 평가다. 차트 도구에서 사용자 수정량을 예측하는 지표는 HR.5F와 verse/chorus 클래스별 오류다. HR3F는 좋아 보여도 한 마디 늦을 수 있다.

### 3.2 비지도 방식: 경계 + 클러스터링
- **Self-similarity matrix(SSM) + Foote checkerboard novelty**
  - beat 동기 크로마나 MFCC로 SSM을 만들고, 대각선을 따라 커널을 밀어 피크를 경계로 잡는다.
  - Müller 튜토리얼: TISMIR 2024 novelty (https://transactions.ismir.net/articles/10.5334/tismir.202), Audiolabs FMP 노트북
- **Laplacian / spectral clustering** (McFee & Ellis, ISMIR 2014): librosa 갤러리에 구현이 있다. (https://librosa.org/doc/0.11.0/auto_examples/plot_segmentation.html)
- **MSAF** (Nieto & Bello): MIT, CI와 PR이 살아 있다.
  - 알고리즘: checkerboard(경계만), 2D-FMC(라벨만), constrained clustering, convex NMF, Laplacian, ordinal LDA, SI-PLCA, structural features
  - 라벨은 **A/B/C일 뿐 verse/chorus가 아니다**. Harmonix 최초 베이스라인도 MSAF였다.
  - MusicTech Lab(2026.01)은 MSAF를 "medium", allin1을 "high", librosa를 "basic"으로 평가했다.
  - 신경망 모델이 라이브 녹음을 과하게 뭉개면 경계 후보 제안용으로 쓰고, 이름 붙이기에는 쓰지 않는다.
- **최신 변형**
  - 2026.03 논문: 마디 단위 딥 임베딩 위에서 Foote, spectral, CBM (https://arxiv.org/abs/2603.27218)
  - Peeters 2023 SSM-loss/novelty-loss (https://arxiv.org/pdf/2309.02243.pdf). 역시 기능 이름은 내지 않는다.
  - Cheng, Nakano, Goto (SMC 2025): 반복 인식 행렬로 대각선을 블록처럼 보이게 만든다. checkerboard만으로 **RWC-Pop F 0.761**이고, 쌓은 행렬에 CNN을 쓰면 RWC-Pop, Beatles, SALAMI에서 기존 경계 성능을 넘는다. 이름은 내지 않는다.
  - 마디 단위 기호 경계(Eldeeb & Malandro, 2025.09): MIDI 피아노롤 F1 0.77. 이미 차트나 MIDI가 있을 때만 해당된다.
- **예배곡에서의 실패 방식**
  - **AAAA, ABAB 형식은 novelty가 거의 없다.** 후렴 위주 곡(verse, chorus, verse, chorus, chorus)이 딱 이 경우다.
  - 커널이 짧으면 필인과 회중 소음에 오작동하고, 길면 2~4마디 turnaround를 먹어버린다(MultiTracks가 굳이 이름 붙이는 구간이다).
  - 템포 드리프트가 대각선 줄무늬를 휘게 해서 반복이 반복으로 보이지 않는다(2025 live coding 연구에서도 같은 취약성).

### 3.3 지도 학습: 기능 라벨링
**SongFormBench-Harmonix (200곡, 7클래스 평가, pre-chorus는 verse로 합침)**
| 방법 | ACC | HR.5F | HR3F |
|---|---|---|---|
| Harmonic-CNN | 0.680 | 0.559 | — |
| SpecTNT (36s) | 0.723 | 0.558 | — |
| All-In-One | 0.740 | 0.596 | 0.730 |
| MusicFM (Zhang et al.) | 0.725 | 0.640 | 0.729 |
| MuQ_iter | 0.772 | — | — |
| LinkSeg-7 | 0.780 | 0.630 | 0.762 |
| Temporal adaptation (Zhang 2025) | 0.787 | 0.610 | 0.801 |
| Gemini 2.5 Pro | 0.748 | **0.423** | **0.813** |
| SongFormer (Harmonix만) | 0.795 | **0.703** | 0.784 |
| SongFormer (전체 데이터) | **0.807** | 0.696 | 0.780 |

**SongFormer** (ASLP-lab, 2025.10, v3 2026.04.08): 현재 공개 SOTA다.
- 링크: https://arxiv.org/abs/2510.02797 · https://github.com/ASLP-lab/SongFormer · https://huggingface.co/ASLP-lab/SongFormer
- 구조: **MuQ**와 **MusicFM**을 30초 창(인코더 학습 단위)과 420초 창(곡 대부분)에서 융합한 뒤, 4층 Transformer로 경계와 8개 라벨을 예측한다.
- 라벨 8개: `intro, verse, pre-chorus, chorus, bridge, inst, silence, outro`. **pre-chorus를 별도 클래스로 둔 첫 모델**이다.
- 학습: source embedding을 두어 노이즈 있는 라벨이나 부분 라벨이 깨끗한 라벨을 덮어쓰지 않게 했다.
  - SongFormDB: 약 14k곡, 다국어
  - SongFormBench: 전문가 검수 300곡(Harmonix 200 + 중국어 100), 오디오 지문으로 학습 데이터와 중복 제거
- 추론: 곡당 **2~4초**(NVIDIA L40). Demucs도 beat tracker도 없다. 후처리 피크 선택은 All-In-One과 같다.
- 다른 결과
  - SongFormBench-CN: ACC **0.891**, HR.5F 0.690. 같은 세트에서 All-In-One HR.5F 0.563, Gemini HR.5F 0.412 / HR3F 0.833
  - RWC-Pop(학습 제외): ACC **0.814**, HR.5F 0.650(Harmonix만 학습한 버전 0.651), HR3F 0.804. LinkSeg 0.747/0.648
- 주의
  - 노이즈 있는 세트(Gemini 라벨 포함)를 추가하면 ACC는 오르고 HR.5F는 약간 내려간다. Gemini 라벨은 기능 이름만 쓰고 경계는 버렸다(최대 약 2초 오차).
  - README는 ACC를 "boundary detection accuracy"라고 쓰지만 논문 정의는 **프레임 라벨 정확도**다. 논문을 따른다.
  - 추론할 때 source embedding은 반드시 Harmonix 것을 써야 한다. 다른 것을 쓰면 라벨 체계가 바뀐다.
  - 420초가 넘는 곡은 잘라서 처리한다. 20분짜리 라이브 세트는 먼저 무음 기준으로 자른다.
  - pre-chorus는 모델에는 있지만 공식 점수에서는 사라진다. 필요하면 직접 채점한다.
  - 학습 도메인은 스튜디오 서구 팝과 중국 팝이다. 회중 녹음은 아니다.
  - **템포는 추정하지 않는다.**
  - 라이선스: 코드 **CC-BY-4.0**. **MuQ와 MusicFM 가중치 라이선스는 확인이 필요하다.** git clone + conda requirements로 설치하고(pip 아님), 체크포인트는 HF에서 받는다. 실용 속도를 내려면 GPU가 필요하다. 저장소 뉴스의 마지막 큰 업데이트는 2025.10이다.

**All-In-One (`allin1`)** (Kim & Nam, WASPAA 2023)
- 라벨: `start, end, intro, outro, break, bridge, inst, solo, verse, chorus`. **pre-chorus가 없다.**
- 저자들의 Harmonix 8-fold 기준 HR.5F 0.660. SongFormer의 7클래스 재평가에서는 ACC 0.740 / HR.5F 0.596 / HR3F 0.730이다. 체크포인트가 아니라 평가 방식 차이다.
- 기본 `harmonix-all`은 8-fold 앙상블이다. RTX 4090에서 10곡(33분 분량)에 73초. 첫 실행 때 약 1.5GB 가중치를 받는다.
- 사람들이 여전히 쓰는 이유: 비트 그리드와 BPM까지 함께 주는 유일한 강한 공개 모델이다(Replicate 포트 `sakemin/all-in-one-music-structure-analyzer` 약 249k 실행, A100에서 약 67초). 결합 학습과 음원 분리 입력이 서로 도움을 준다.
- 교회 오디오에서의 실패
  - BPM을 하나만 낸다. ritardando, double-time 후렴, 끌리는 오르간 템포(@LDSBoomstick)가 틀린 숫자 하나가 되고, 그 그리드에 맞춘 경계도 모두 같이 밀린다.
  - 라이브 공간에서 Demucs가 회중 소리를 보컬 stem으로 끌어오고 other stem을 번지게 한다. 구조 학습은 분리된 스튜디오 stem으로 했다.
  - `break`, `solo`는 차트의 turnaround, tag, vamp와 다르다.
- 설치: MIT. PyPI 마지막은 1.1.0(2023.10)이고 classifier가 Python 3.11까지라 사실상 방치됐다. NATTEN 수동 설치가 필요하다(torch/CUDA 버전을 맞춰야 하고 CPP 백엔드 import 오류가 알려져 있다, NATTEN #218). madmom은 git으로, ffmpeg도 필요하다. MP3는 디코더 오프셋 때문에 WAV로 변환하라고 권장한다. CPU나 macOS에서도 돌지만 Demucs 때문에 느리다.

**기타 모델**
- **LinkSeg** (Buisson, McFee, Essid, ISMIR 2024)
  - 모든 프레임 쌍이 같은 segment인지, 같은 section인지, 다른지를 예측하고 graph attention으로 경계와 라벨을 낸다.
  - 7클래스(intro, verse, chorus, bridge, instrumental, outro, silence)와 9클래스 체크포인트가 있다.
  - 이름이 틀려도 "이 두 구간은 같다"를 잘 잡는다. Chorus 1과 Chorus 2를 번호 매길 때 유용하다. 반대로 verse와 chorus의 그루브가 같으면(CCM에서 흔함) 약하다.
  - https://github.com/morgan76/LinkSeg
- **Temporal adaptation of MusicFM** (Zhang et al., 2025.07): 30초 인코더를 100~180초로 늘리면 ACC 0.787, HR3F 0.801로 오르지만 HR.5F는 0.640에서 0.610으로 떨어진다. SongFormer는 이 trade-off를 거부하고 30초 특징(경계용)과 420초 스트림(형식용)을 함께 쓴다. (https://arxiv.org/abs/2507.13572)
- **MuQ** (Zhu et al., 2025.01): iter 변형 Harmonix ACC 0.772. SongFormer는 MuQ와 MusicFM의 10번째 층을 쓴다.
- **Korzeniowski & Vogl, ISMIR 2025** "Simple and Effective Semantic Song Segmentation"
  - CNN + SSM lag 행렬
  - 라벨 매핑이 예배 차트에는 함정이다: **pre-chorus와 prechorus는 verse로, refrain은 chorus로, rap은 verse로** 바뀐다.
  - SALAMI와 RWC-Pop 학습/테스트 사이에 **최대 22% 중복**이 있음을 발견했다. 예전 "RWC SOTA" 주장 일부는 데이터 누수다. McGill Billboard로 테스트하자고 제안한다.
- **MIREX 2025**
  - 공식 과제는 7개 기능(intro, verse, chorus, bridge, inst, outro, other/silence)이다. pre-chorus가 공식 과제 밖이라 논문들이 계속 지운다.
  - MusicFM 베이스라인(Harmonix 학습) HR.5 0.644. 외부 6k곡으로 학습한 All-in-One 변형은 accuracy 0.720, HR.5 0.590.
- **데이터셋**: Harmonix Set(약 900곡 팝, 주석만 제공되고 오디오는 직접 구해야 함), SALAMI, RWC-Pop, SongFormDB와 SongFormBench(HF), McGill Billboard.
- SongFormer를 확실히 넘는 검증된 최신 모델은 찾지 못했다.

### 3.4 가사 기반 방법
**오디오만으로는 verse와 chorus를 신뢰성 있게 구분할 수 없다.** BASS 벤치마크(2026.02)가 그렇게 명시한다. 실제 단서는 반복되는 멜로디와 **반복되는 가사**다.
- **예배곡의 강점**: 가사 악보(CCLI/SongSelect 등)에 이미 `[Verse 1]/[Chorus]/[Bridge]/[Tag]`가 표시돼 있다. 이를 오디오에 정렬하면 **우리 서비스의 어휘와 번호(Verse 1 vs Verse 2)를 그대로 얻는다.** 어떤 오디오 모델도 이 번호를 주지 않는다.
- **발표된 연구**
  - **가사만으로 후렴 검출**: Watanabe & Goto(IEICE 2023)는 가사 줄 self-similarity로 sequence labeling을 한다. 반복 패턴은 언어와 무관해서 일본어 모델이 영어로 옮겨진다. Fell et al.(COLING 2018): 정확한 반복은 chorus, 마지막 짧은 반복은 outro.
  - **SongPrep** (Tan et al., 2025.09.22, https://arxiv.org/abs/2509.17404)
    - 구조 분석을 먼저 하고 verse, chorus, bridge만 전사한다.
    - Whisper WER **27.7%**, fine-tune한 Zipformer **25.8%**
    - wav2vec2 정렬기가 긴 기악 구간을 verse나 chorus로 부르지 않게 막는다.
    - E2E 모델 SongPrepE2E는 SSLD-200에서 구조 diarization 오류를 **25.0% → 16.1%**로 낮췄고 분리기가 필요 없다.
    - 목적은 곡 생성용 데이터 정제지만, 보정 방식 자체는 차트에도 맞는다.
  - **Whisper를 전사기가 아닌 정렬기로**: WEALY는 Whisper 디코더 임베딩으로 가사를 매칭한다. RefWhisper는 불완전한 참조 가사로 조건을 준다. 가독성 연구에서는 Whisper의 줄바꿈이 가사 줄과 자주 일치했고, **Demucs를 먼저 돌리면 Whisper가 오히려 나빠질 수 있었다**. (https://arxiv.org/html/2408.06370v1)
  - SongFormer도 학습 데이터 일부에 약한 형태로 이 방법을 썼다. YouTube 텍스트를 SOFA 가창 정렬기로 확인하고, 구간의 10% 이상이 1초 넘게 어긋나면 그 곡을 버렸다.
- **정렬 시 주의**
  - 가창 전사는 말보다 훨씬 어렵다. 적응한 Whisper-large-v3도 WER 약 27%(그리스어 ALT, https://arxiv.org/html/2609.11302)
  - MFA는 멜리스마를 무음으로 처리한다. (https://arxiv.org/pdf/2507.06670)
  - WhisperX VAD는 verse 전체를 합쳐버린다. 반복이 많은 곡에서 기준점이 어긋나 첫 줄이 53초 늦게 매칭된 사례가 있다(muvid #101).
  - 그래서 **구간 단위로 매칭한다**: 텍스트를 후보 구간과 퍼지 매칭하고, 허용된 구간 순서에 대해 DP나 HMM을 돌린다. 단어 단위 타이밍은 믿지 않는다.
  - 애드리브, 보컬 위의 회중 노래, 말로 하는 기도, CCLI 차트에 없는 "oh" vamp에서는 깨진다.
- 파이프라인: Demucs로 보컬 분리(단 Whisper에는 역효과일 수 있으니 비교 필요) → WhisperX(wav2vec2 CTC)나 MFA로 알려진 가사를 강제 정렬한다. 인식 결과는 "지금 어느 구간을 부르는가" 판단에만 쓴다.

### 3.5 Audio LLM
- **Gemini 2.5 Pro** (SongFormer 프로토콜): 라벨은 괜찮고 경계는 나쁘다. Harmonix ACC 0.748, **HR.5F 0.423**, HR3F 0.813. 경계는 최대 약 2초 거칠고, 형식이나 단조성 위반 출력이 있어 걸러내야 했다.
- **BASS 벤치마크** (Jang et al., 2026.02.03, https://arxiv.org/abs/2602.04085)
  - 대상: audio LM 14개(Gemini 2.5 Pro/Flash, Qwen3-Omni, Step-Audio-R1, Kimi Audio, Music Flamingo, Audio Flamingo 3, SALMONN 등), 1,993곡
  - 구조 분할은 가장 낮은 범주 중 하나다. Gemini 2.5 Pro는 구조 추론 26.5%, 나머지 대부분은 15% 미만이다. 가사 전사는 가장 높은 범주 중 하나다.
  - "verse가 어디냐"고 묻는 것보다 **전체 형식**을 한 번에 묻는 것이 평균 **7.63점** 높다.
  - 인트로에서 정확도가 가장 높고 아웃트로로 갈수록 떨어진다.
  - **verse와 chorus 혼동이 주된 오류다.** 음향 정보만으로는 구분을 기대하면 안 된다.
  - 요청 라벨에 pre-chorus와 post-chorus가 있다. MIREX 모델은 이를 내지 않는다.
- X 사례: @jmacftw(2026.09.27)는 스펙트로그램, 크로마, 라우드니스, 템포, key를 고전 DSP로 먼저 계산하고 불확실성을 표시한 뒤, 열린 질문에만 작은 Gemini 호출을 쓴다. @Kujar3(2026.09.26)는 에이전트가 stem을 분리하고 스펙트로그램을 읽고 시간 정보가 있는 가사 추출기를 돌리는 것을 봤다. 믹스를 audio LLM에 통째로 주고 타임스탬프를 믿는 것보다 정직한 구조다.
- **결론: LLM은 정확한 경계 위에서 라벨 이름을 정하거나 정리하는 단계로만 쓴다(텍스트 전용). audio LLM을 경계에 쓰지 않는다.**

### 3.6 예배 현장이 쓰는 제품 (목표 형식과 UX)
이 제품들은 공개된 분할 알고리즘이 아니다. 우리 출력이 맞춰야 할 **라벨 체계와 UX**다.
- **Moises Sections**
  - 구간을 자동 검출하고 downbeat에서 루프한다. 기본 이름은 intro, chorus, verse 등이고 유료 플랜에서 이름을 바꿀 수 있다.
  - 마케팅 페이지는 "Sections A, B, C"라고도 하고, 구조가 불명확한 곡을 다루는 교회 음악가를 직접 언급한다.
  - 정밀도, 재현율, 라벨 체계는 공개하지 않았다. Apple 개발자 사례(2025.06)는 stem 분리에 관한 것이다.
  - 제품이 존재한다는 증거일 뿐 벤치마크가 아니다.
- **MultiTracks Playback / ChartBuilder**
  - 구간은 **마디의 downbeat**에 작성된다.
  - 새로 올린 클라우드 곡은 사람이 마커를 추가하기 전까지 **Intro라는 구간 하나**다. 카탈로그 곡은 맵이 딸려 온다.
  - 어휘가 어떤 MIR 논문보다 넓다: 번호 붙은 chorus, pre-chorus, bridge에 더해 **post-chorus, turnaround, refrain, rap**, 짧은 interlude. Click 구간과 Count Off도 있다.
  - guide cue가 다음 구간을 음성으로 알려준다. Premium 사용자는 구간을 재배열, 삭제, 루프할 수 있고 ChartBuilder가 그 맵을 따른다.
  - **알고리즘이 아니라 목표 형식이다.**
- **Loop Community Prime**
  - 구매한 트랙에는 구간 블록이 딸려 온다. 자체 오디오는 마디 그리드에 손으로 마커를 찍어야 한다. 드래그, 삭제, 복제하면 밴드 cue가 갱신된다.
  - Rehearse는 구간 루프를 지원하고 WorshipTools 안에서 동작한다. FAQ에 따르면 **Planning Center 연동은 아직 없다**.
  - @LoopCommunity(2026.04.07)의 포스트는 자동 분할이 아니라 커스텀 cue(메들리 대응)에 관한 것이다.
- **Planning Center Services**
  - 구조는 텍스트다. arrangement에 **sequence**(Intro, Verse 1, Chorus, Bridge x2)가 있고, 코드 차트의 `[Verse]`, `[Chorus]` 제목에서 파싱한다. API는 오디오가 아니라 차트에서 `{label, lyrics}`를 반환한다.
  - 에디터가 **곡 중간 key change**를 지원한다. 마지막 후렴 key up은 이렇게 저장해야 한다.
  - BPM과 박자는 입력 필드다. MultiTracks, SongSelect, PraiseCharts에서 차트를 가져올 수 있다.
  - 2021 영상: 코드는 같고 가사가 다를 수 있어서 Chorus 1과 Chorus 2가 따로 존재한다.

### 3.7 X 반응
- 2024~현재 X에서 MIR 저자들(Kim, Nieto, McFee, SongFormer 팀)의 기술 스레드는 **찾지 못했다**. 공개 대화는 실무자와 제품 데모 중심이다.
- 음악가들이 주목한 모델은 SongFormer가 아니라 **All-In-One**이다. @deepfates(2024.10.28, 좋아요 약 2.4k): Replicate 모델이 stem 분리, BPM, verse/chorus 표시를 곡 재생보다 빨리 한다. 답글: 예전엔 Audacity로 손으로 했다(@daniel_nguyenx).
- 개발자들은 블랙박스 한 번 호출을 믿지 않는다. 스펙트로그램 + 크로마 + 가사 타이머를 쓰고, 그 뒤에 가벼운 Gemini 호출을 붙인다(@jmacftw, @Kujar3).
- 예배 관련 포스트는 분할 정확도가 아니라 **회중이 그 편곡을 부를 수 있는지**에 관한 것이다.
  - Brant Hansen(2025.12.22): 부르기 쉬운 key를 고르고, 볼륨을 낮추고, 익숙한 곡 편곡을 바꾸지 말라.
  - Svigel(2026.09.07), Fiene(2026.09.01): 장식과 음역에 대한 같은 이야기.
  - 그래서 chorus 이름을 바꿔버리거나 key up을 놓친 맵은 ACC가 좋아도 제품 실패다.
- 수치 없는 벤더 주장이 흔하다. @itsshara_ai(2026.07.26): OiiOii가 영상 편집 전에 intro, verse, chorus로 나눈다. 평가 자료는 없다.

### 3.8 예배곡 특유의 함정
- **마지막 후렴 key up**: novelty와 stem 에너지가 모두 튀므로 모델이 경계를 넣고 새 구간을 bridge나 outro로 부르는 경우가 많다. 기능은 여전히 chorus다. Planning Center처럼 **chorus + key change**로 저장한다.
- **pre-chorus, post-chorus, turnaround, tag**: Harmonix 주석에는 이 단어들이 있지만 All-In-One과 MIREX는 지운다. SongFormer는 pre-chorus를 두지만 공식 점수에서 숨긴다. MultiTracks는 모두 정식 라벨로 다룬다. 사후 매핑: tag = chorus 끝부분의 짧은 반복, turnaround/interlude = 보컬 구간 사이의 짧은 `inst`.
- **Chorus 1 vs Chorus 2**: 코드는 같고 가사가 다르다. 오디오 모델은 한 클래스로만 낸다. 가사, 또는 LinkSeg식 "같은 구간" 링크와 가사 동일성을 함께 써야 번호를 매길 수 있다.
- **변형된 반복 후렴** (key lift, half-time, 아카펠라, "drums in"): SSM 클러스터링은 이를 다른 문자로 나눌 수 있다. 가사가 같으면 합친다.
- **기악 구간** (intro, turnaround, interlude): 가사 정렬의 기준점이 없다. 오디오 모델의 `inst`/`intro` 라벨과 downbeat 그리드 스냅을 쓴다.
- **vamp, 즉흥 찬양, 4~8번 반복되는 bridge, 기도, 회중 소리, 말로 하는 카운트오프**
  - 블록 가정을 깨고, Harmonix식 prior와 가사 악보 순서도 깬다. MSAF는 과분할하고, 스튜디오 팝으로 학습한 신경망은 소음을 intro, break, inst로 부른다.
  - 대응: DP에서 반복 횟수 제한을 없애고, 보컬은 있는데 가사가 매칭되지 않으면 "Spontaneous/Vamp" 라벨을 붙인다.
- **말하기 위의 음악**: 패드 위 기도나 성경 봉독은 ASR과 모델을 모두 혼란스럽게 한다.
- **도메인 이동은 이미 측정되어 있다**: All-In-One HR.5F는 Harmonix 0.596에서 SongFormBench-CN 0.563으로 떨어진다. 교회에서 폰으로 녹음한 파일은 그보다 더 큰 이동이다.

### 3.9 라이선스와 설치
| 패키지 | 라이선스 | 상태 |
|---|---|---|
| SongFormer | 코드 CC-BY-4.0, **MuQ/MusicFM 가중치 확인 필요** | git clone + conda, GPU 필요 |
| allin1 | MIT | PyPI 1.1.0(2023.10), NATTEN과 madmom(git) 필요, 2026 재패키지 `all-in-one-infer` 있음 |
| MSAF | MIT | pip, CPU |
| librosa | ISC | pip, CPU |
| WhisperX | BSD | pip, GPU 권장 |
| LinkSeg | GitHub 공개 | — |

### 3.10 Arrangement 권장 파이프라인
1. **전처리**: 44.1kHz WAV로 디코딩한다. Demucs로 stem을 분리한다(보컬은 ASR용, allin1은 내부에서 분리). 20분 넘는 라이브 세트는 먼저 무음 기준으로 자른다.
2. **오디오 구조**: SongFormer로 경계와 기능 라벨(8클래스)을 구한다. allin1은 대체·2차 의견용이자 beat/downbeat 그리드용이다. 경계를 **downbeat에 스냅**한다.
3. **key와 tempo는 별도 트랙**으로 beat 그리드 위에서 계산한다. 전조는 chorus 안에서 일어나는 것이지 새 구간이 아니다.
4. **가사 기준점** (가사 악보가 있을 때)
   - 보컬 stem(또는 원본, 비교 필요)에 WhisperX를 돌린다.
   - 각 윈도우를 악보의 태그된 구간과 퍼지 매칭한다.
   - 구간들에 대해 Viterbi나 DP를 돌린다(상태 = 악보 구간 + inst/vamp, 반복 허용).
   - 결과로 "Verse 2", "Chorus", "Tag" 같은 이름을 붙인다.
   - 반복되는 가사 블록은 chorus, 한 번만 나오는 블록은 verse, 가사가 없으면 intro/instrumental/outro다.
5. **결합**
   - 오디오 경계는 구간이 **어디서** 시작하고 끝나는지를 정한다.
   - 가사 매칭은 보컬 구간의 **이름**을 정한다.
   - 오디오 라벨은 보컬이 없는 구간(intro, instrumental은 Interlude/Turnaround, outro)을 정한다.
   - 인접한 같은 이름 구간을 합친다.
   - 확신도가 낮은 구간은 UI에서 사람이 검토하도록 표시한다.
6. **출력 형식**: MultiTracks식 song map이나 Planning Center식 sequence에 맞춘다. pre-chorus, tag, vamp는 사람이 이름을 바꿀 수 있어야 한다.
7. **선택**: 텍스트 전용 LLM으로 최종 라벨 순서를 정리한다. audio LLM을 경계에 쓰지 않는다.
8. **평가**: 예배 녹음 약 30곡(스튜디오와 라이브)을 직접 주석하고 mir_eval로 HR.5F, HR3F, 라벨 ACC를 추적한다.

---

## 4. 전체 통합 파이프라인 (초안)

```
입력 오디오
 └─ ffmpeg 디코딩 (44.1kHz WAV) + 튜닝 추정
     ├─ [1] Beat This! (DBN 없이) → beats, downbeats
     │      └─ 박자(마디 박 수) 추정, octave 후보 {T/2, T, 2T}(+×3, ÷3)
     ├─ [2] SongFormer (+ 선택: allin1) → 구간 경계와 기능 라벨
     │      ├─ 경계를 downbeat에 스냅
     │      └─ (가사 악보가 있으면) WhisperX + 구간 DP → Verse 1/2, Chorus, Tag…
     ├─ [3] 구간별 BPM (median 간격) + 템포 곡선 + 안정성 플래그 + half-time 플래그
     └─ [4] Demucs bass+other → 구간별 크로마 → 구간별 key (Krumhansl/Temperley + 코드 모델)
            └─ 반복 chorus의 OTI (+1/+2) + 구간 key 차이 → 전조 판정
출력: { bpm: {value, alternates, meter, feel, stability, curve},
        key: {primary, changes: [{at, from, to, section}], runner_up},
        arrangement: [{label, start, end, confidence}] }
```

---

## 5. 결정·확인이 필요한 사항

1. **라이선스 정책**: 상업 서비스라면 **madmom 모델(NC), Essentia(AGPL) / TempoCNN(NC), KeyMyna(라이선스 미표기)**는 제외된다. 남는 후보는 **Beat This!(MIT), librosa(ISC), Demucs(MIT), BTC(MIT), allin1(MIT, 단 madmom의 어느 부분을 쓰는지 확인 필요)**다. Chordino는 GPL이다. SongFormer는 백본 가중치 라이선스를 확인해야 한다.
2. **검증 세트 구축**: 예배곡 공개 벤치마크는 없다. **30~50곡(스튜디오와 라이브 반반)**을 직접 라벨링한다.
   - 지표: BPM Acc1, Acc2, beat F1 / key MIREX weighted + 전조 검출 여부 / 구간 HR.5F, HR3F, ACC
   - 같은 곡의 스튜디오 버전과 라이브 버전을 학습과 테스트에 나눠 넣지 않는다(cover-song 효과).
3. **첫 스파이크**: Colab MCP(이 세션에서 설정 완료)로 Colab GPU에서 Beat This!, SongFormer, allin1을 예배곡 5~10곡에 돌려 비교한다. SongFormer의 pip/CPU 동작, Beat This! CPU 실행 시간(small 모델로 곡당 수 초로 추정), allin1 CPU 실행 시간(곡당 수십 초로 추정)은 **아직 측정하지 않았다.**
4. **검증되지 않은 가정**: 6/8 곡의 BPM을 점4분음표 기준으로 보고하는 것이 CCLI/SongSelect 관례와 맞는지 확인이 필요하다.
5. **출력 규약**: 오디오 key와 차트 key(카포, 남녀 key)를 구분하고, 전조(transpose)는 별도 기능으로 둔다.
