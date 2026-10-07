# Audio → BPM 조사

- 조사일: 2026-09-28
- 목적: 곡 오디오 파일을 입력하면 **key(곡 중 key up/down 포함)**, **arrangement(예: Verse > Chorus)**, **BPM**을 반환하는 기능의 측정 방법 조사
- 대상 도메인: 예배/CCM 곡 (스튜디오 음원 + 라이브 녹음)

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

