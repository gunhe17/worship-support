# Audio → Key 조사

- 조사일: 2026-09-28
- 목적: 곡 오디오 파일을 입력하면 **key(곡 중 key up/down 포함)**, **arrangement(예: Verse > Chorus)**, **BPM**을 반환하는 기능의 측정 방법 조사
- 대상 도메인: 예배/CCM 곡 (스튜디오 음원 + 라이브 녹음)

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

