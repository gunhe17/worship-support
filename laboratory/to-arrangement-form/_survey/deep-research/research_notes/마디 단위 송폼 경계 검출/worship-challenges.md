# 워십(찬양) 음악 송폼 경계 검출의 난점과 대응 기법

> 맥락: 한국 찬양 500곡, beat/downbeat는 Beat This! + DBN으로 신뢰 가능, 섹션별 key detection과 Whisper large-v3 STT 결과 보유, 연산은 Kaggle에서만.
> 조사 범위: 약 20회 검색/열람. 1차 출처(ISMIR/TISMIR/arXiv)를 우선했고, 확인하지 못한 수치는 Gaps에 따로 적었다.

## 1. 전조(key change, 마지막 후렴 반음/온음 상승)와 chroma SSM

### Takeaway
chroma SSM은 전조된 반복 구간을 서로 다른 구간으로 본다. 표준 해법은 12개 cyclic shift 중 최소 거리(=최대 유사도)를 취하는 transposition-invariant SSM(Müller & Clausen 2007)과 OTI(Serrà)다. 다만 boundary F-measure가 실제로 얼마나 오르는지 정량 보고한 자료는 찾지 못했다. 우리는 섹션별 key를 이미 알고 있으므로, 섹션 key 기준으로 chroma를 정규화(roll)하는 것이 가장 싸고 직접적인 대응이다.

### Cited Findings
- Müller & Clausen, "Transposition-Invariant Self-Similarity Matrices", ISMIR 2007, pp.47–50. 이 논문은 key가 바뀐 반복도 드러내는 SSM과, 각 셀의 화성 이동량을 담는 transposition index matrix를 제안한다. Goto의 chroma cyclic shift 아이디어를 가져왔다. 동기는 "다른 key로 반복되는 섹션을 일반 SSM이 놓친다"는 것이다 — [ISMIR archive PDF](https://archives.ismir.net/ismir2007/paper/000047.pdf), [Webis anthology](https://ir.webis.de/anthology/2007.ismir_conference-2007.5)
- Müller 강의자료: 12개 shift SSM에 대해 min을 취하고 path extraction을 안정화하는 예시("In The Year 2525")를 보여준다 — [Müller 2008 lecture](https://resources.mpi-inf.mpg.de/departments/d4/teaching/ss2008/ir_mm/2008_Meinard_Mueller_Lecture_IR_AudioStructure.pdf)
- FMP 노트북 C4S2 예시 (Zager & Evans "In the Year 2525"). 구조는 I, V1–V8, B, O이다. V5–V6은 +1 semitone, V7–V8은 +2 semitone으로 전조된다. 일반 chroma SSM(path enhancement 적용)은 V1–V4끼리, V5–V6끼리, V7–V8끼리만 연결하고 전조 전후 verse는 연결하지 못한다. 노트북 설정은 chroma 10 Hz(smoothing 41, downsample 10), diagonal filter L=8이다. 효과는 정성적 그림으로만 제시되고 수치 평가는 없다 — [FMP C4S2 Transposition Invariance](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S2_SSM-TranspositionInvariance.html)
- OTI(Optimal Transposition Index): Serrà, Gómez, Herrera (2008) "Transposing chroma representations to a common key"에서 유래했다. 한 곡의 chromagram을 다른 곡의 key로 shift한 뒤 비교하는 방식이다. Essentia `ChromaCrossSimilarity`는 기본으로 12 circular shift를 검사하고 OTI 옵션도 기본 on이다. binary OTI 유사도는 Serrà et al. IEEE TASLP 16(6) 2008에서 나왔다 — [Essentia ChromaCrossSimilarity](https://essentia.upf.edu/reference/std_ChromaCrossSimilarity.html), [UPF repository (TASLP 2008)](https://repositori.upf.edu/items/8da678c4-09d5-4a27-9a7e-ae0ba276545a/full)
- 팝에서 전조가 얼마나 흔한가: Billboard Hot 100 1위곡 중 전조 포함 비율은 1960–1995년에 연 20–35%였고 2000년대 말에는 0%에 가까웠다(Chris Dalla Riva 분석, 블로그 출처). Mauch의 UK 차트 분석에서는 "gear change" 비율이 약 15%(1960 무렵)에서 4% 미만(2000년대)으로 줄었다 — [Can't Get Much Higher](https://cantgetmuchhigher.com/p/revisiting-the-death-of-the-key-change), [NPR/NHPR 2022](https://www.nhpr.org/2022-11-25/why-the-key-change-has-disappeared-from-top-charting-tunes)
- deep audio embedding(SSL 등 9개 범용 사전학습 모델)을 barwise로 뽑아 Foote, spectral clustering, CBM에 넣은 비교에서, deep embedding은 spectrogram baseline보다 "대체로 낫지만 항상 그렇지는 않다". 모든 조건에서 CBM이 가장 좋았다. 같은 논문은 표준 MSA metric이 부풀려져 있다며 annotation "trimming"을 권고한다. 초록 기준이며 key-invariance는 다루지 않는다 — [arXiv 2603.27218](https://arxiv.org/abs/2603.27218)

### Inferences
- 최근 세속 팝과 달리 CCM/워십 라이브에서는 마지막 후렴 반음/온음 상승이 여전히 흔한 편곡 관습으로 보인다(아래 5절의 편곡 관행 참고, 정량 출처는 없음). 그래서 전조 대응의 중요도가 일반 MSA 벤치마크보다 높다.
- 우리는 섹션별 key를 이미 갖고 있다. 따라서 TI-SSM이나 OTI로 shift를 "추정"하는 대신 각 bar의 chroma를 그 bar가 속한 섹션 key의 tonic 기준으로 roll(상대 chroma, tonic=0)하면, 12-shift min을 계산할 필요 없이 같은 효과를 얻는다. 단점은 key detection 오류가 그대로 SSM에 전파된다는 것이다. 보완책은 두 가지다. (a) key-normalized SSM과 TI-SSM(12-shift max)을 element-wise max로 합친다. (b) TI-SSM의 transposition index matrix를 key detection 검증에 쓴다.
- TI-SSM에는 부작용이 있다. 12 shift 중 최대를 취하면 서로 다른 섹션 간 우연한 유사도도 올라가 false repetition이 늘 수 있다. 워십곡은 verse와 chorus가 같은 4-chord 진행을 공유하는 경우가 많아 이 위험이 더 크다(추론).
- 전조는 boundary 단서이기도 하다. key가 바뀌는 bar는 거의 항상 섹션 경계이므로, 이미 있는 섹션 key 결과의 key 변화점을 boundary 후보로 강하게 가중할 수 있다.
- MFCC/timbre 계열이나 SSL embedding은 key 변화에 덜 민감할 것으로 기대된다. 그러나 이를 직접 측정한 결과는 찾지 못했다.

### Gaps
- TI-SSM 또는 OTI를 structure boundary 검출에 적용했을 때의 F0.5/F3 개선 수치는 찾지 못했다. FMP와 원 논문은 정성적 예시만 제시한다.
- shift-invariant 2D-FMC(2D Fourier magnitude coefficients, Nieto & Bello 계열 segment labeling)의 전조 강건성 수치는 이번 조사에서 확인하지 못했다.
- 워십/CCM에서 마지막 후렴 전조 빈도를 다룬 정량 연구는 찾지 못했다.

## 2. 긴 라이브 녹음(6–10분 이상): 반복 후렴, vamp, 즉흥 경배, 기도, 박수, ad-lib

### Takeaway
라이브 워십 구조 분석을 다룬 MIR 연구는 찾지 못했다. 최신 supervised 모델은 곡 길이에 상한이 있다. SongFormer는 420초에서 truncation하므로, 7분이 넘는 라이브곡은 뒷부분(대개 마지막 후렴, vamp, tag)을 잃는다. 긴 곡은 chunking이나 barwise unsupervised(CBM 등) 경로가 필요하다.

### Cited Findings
- SongFormer (Hao et al., arXiv 2510.02797, 2025):
  - 입력: local feature는 30초 chunk 연속, global feature는 420초 window. 25 Hz feature를 3배 downsample해 약 8.33 Hz.
  - 420초보다 긴 곡은 truncate한다. SSL encoder는 MuQ와 MusicFM이고, label은 7 class(pre-chorus는 평가 시 verse로 매핑).
  - 데이터: HarmonixSet 512/200, Private 4,314, Hook 5,933(partial), Gem 4,387. 전체 10k곡 이상.
  - 라이브 녹음에 대한 언급은 없다 — [SongFormer arXiv HTML](https://arxiv.org/html/2510.02797v2)
- SongFormBench 결과 (ACC / HR.5F / HR3F):

  | 조건 | ACC | HR.5F | HR3F |
  |---|---|---|---|
  | HarmonixSet, All-In-One | 0.740 | 0.596 | 0.730 |
  | HarmonixSet, SongFormer | 0.807 | 0.696 | 0.780 |
  | 중국어 100곡(CN), All-In-One | 0.834 | 0.563 | 0.771 |
  | 중국어 100곡(CN), SongFormer | 0.891 | 0.688 | 0.851 |

  Gemini 2.5 Pro는 Harmonix에서 HR3F 0.813으로 relaxed 지표가 가장 높았다 — [SongFormer arXiv HTML](https://arxiv.org/html/2510.02797v2)
- 코드와 체크포인트 공개(GitHub, HF 데모). 벤치마크 데이터셋 SongFormBench는 Harmonix 200곡 + 중국어 100곡이다 — [GitHub aslp-lab/songformer](https://github.com/aslp-lab/songformer), [HF SongFormBench](https://huggingface.co/datasets/ASLP-lab/SongFormBench)
- Grill & Schlüter(2015) CNN boundary detector는 당시 최고 성능이었다. 그러나 순수 spectrogram 입력은 반복 같은 non-local 단서로 정의된 경계를 자주 놓쳐서, 저자들이 self-similarity lag matrix를 추가했다 — [Schlüter pubs](https://ofai.at/~jan.schlueter/pubs/2014_ismir)
- 라이브 앨범의 트랙 경계와 실제 공연 경계가 다를 수 있다는 지적(편집, 재배열, 다른 공연분 접합)은 저품질 aggregator 출처에서만 나왔다. 참고용으로만 쓴다 — [gravitee corpus page (저신뢰)](https://gravitee.io/corpus/gen-1140/as-recorded-at-madison-square-garden/setlist-track-listing-and-song-structure-analysis-for-as-recorded-at-madison-square-garden.html)

### Inferences
- 같은 후렴을 4–8회 반복하면 SSM은 강한 대각선 블록으로 가득 찬다. 이 경우 novelty kernel은 반복 사이 경계(chorus→chorus)를 약하게 잡는다. 동일 섹션 연속 반복의 경계는 SSM이 아니라 phrase prior(8/16마디 주기, 4절)와 가사 반복(STT, 6절)으로 나누는 편이 맞다.
- vamp나 즉흥 경배 구간은 화성 반복(2–4 chord loop)이 길고 가사가 불규칙하다. homogeneity 기반(CBM 등)은 이 구간을 하나의 큰 segment로 묶는 경향이 있을 것이다. 라벨링 관점에서는 이게 오히려 바람직할 수 있다("Vamp" 1개 섹션).
- 기도/멘트/박수 구간은 STT 결과(음악 없이 말소리만)와 vocal stem은 있으나 accompaniment 에너지가 낮은 구간으로 표시해 SSM에서 마스킹하는 전처리가 합리적이다(추론, 출처 없음).
- SongFormer 같은 사전학습 모델은 420초 상한이 있다. 따라서 10분 라이브는 (a) 마디 경계에서 겹치는 window로 나눠 추론한 뒤 병합하거나, (b) barwise SSM + DP(CBM) 같은 길이 제한 없는 unsupervised 방법을 주 경로로 쓰는 선택지가 있다. CBM의 DP는 bar 수 B에 대해 다항 시간이므로 10분(약 200–300 bar)도 문제없다.

### Gaps
- 라이브 콘서트/예배 녹음의 구조 분석, setlist/medley 분할을 다룬 학술 논문은 이번 검색에서 찾지 못했다(검색 결과는 저품질 aggregator뿐이었다).
- All-In-One(Kim & Nam 2023)의 입력 길이 한계와 메모리 특성은 확인하지 못했다.
- 박수/멘트/기도 구간 검출을 구조 분석 전처리로 쓴 연구는 찾지 못했다.

## 3. 템포 변화, 리타르단도와 beat/bar-synchronous feature

### Takeaway
bar-synchronous feature는 각 프레임 정보를 템포가 아닌 박자 위치에 묶는다. 그래서 템포가 흔들려도 SSM 대각선이 직선으로 유지된다. Marmoret et al.(TISMIR 2023)의 정량 결과로는 bar 단위 처리가 SALAMI에서 이득, RWC Pop에서는 혼재였다. barwise TF 행렬은 두 데이터셋 모두에서 최고였다.

### Cited Findings
- Marmoret, Cohen, Bimbot, "Barwise Music Structure Analysis with the Correlation Block-Matching Segmentation Algorithm", TISMIR 6(1) 2023. 저자들은 bar 단위 계산이 "각 프레임 정보가 템포가 아니라 metrical position에 의존하도록 보장한다"고 쓰고, 팝은 bar 수준에서 규칙적이라 경계가 주로 bar 사이에 있다고 논증한다 — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- 같은 논문 Table 2, Foote(2000) on SALAMI-test (F0.5s / F3s):

  | 동기화 방식 | F0.5s | F3s |
  |---|---|---|
  | beat-sync 원본 | 29.21% | 54.02% |
  | beat-sync 결과를 downbeat에 재정렬 | 33.33% | 53.78% |
  | bar-synchronized | 35.97% | 55.57% |
  | Barwise TF matrix | 39.67% | 60.36% |

  — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- Table 3, Foote on RWC Pop (F0.5s / F3s):

  | 동기화 방식 | F0.5s | F3s |
  |---|---|---|
  | beat-sync | 27.29% | 57.95% |
  | downbeat 재정렬 | 36.52% | 57.44% |
  | bar-sync | 32.46% | 51.97% |
  | Barwise TF | 43.30% | 65.04% |

  저자 결론: bar-sync feature는 SALAMI에서는 성능을 올리고 RWC Pop에서는 내린다. Barwise TF는 양쪽 모두 이득이다 — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- Barwise TF matrix(각 bar를 고정 개수 subdivision으로 리샘플한 spectrogram을 펼친 행렬)는 bar 내부의 시간 구조까지 보존하면서 템포에 정규화된 표현이다 — 같은 출처
- librosa beat tracker로 feature를 beat 단위로 집계하는 MSAF 관행과 beat-sync feature 사용은 표준이다 — [arXiv 2311.18604 및 MSAF 인용](https://arxiv.org/pdf/2311.18604)

### Inferences
- 워십 라이브는 엔딩 리타르단도, 브릿지 build-up 중 미세 accelerando, 클릭 없는 밴드의 템포 drift가 흔하다. downbeat가 신뢰 가능하다면 Barwise TF처럼 bar마다 고정 길이로 리샘플하는 표현이 가장 직접적인 해법이다.
- 프리템포(free-time) 구간(즉흥 기도 패드, 인트로 패드)에서는 downbeat 자체가 무의미하다. 이 구간은 downbeat 신뢰도(DBN activation)가 낮은 bar로 따로 처리해야 한다(추론).

### Gaps
- 템포 변화나 리타르단도가 있는 곡만 따로 모아 beat-sync SSM 강건성을 측정한 연구는 찾지 못했다.

## 4. Phrase 수준 prior: 4/8/16마디, bar-grid 제약, 구간 길이 penalty DP

### Takeaway
경계를 downbeat로 snap하면 F0.5s가 크게 오르고 F3s는 거의 변화가 없다. 구간 길이 prior("modulo 8" penalty)는 정확 경계(0-bar tolerance)를 약간 개선하는 데 그친다(SALAMI-train F0bar 45.81%→46.63%). 큰 이득은 bar-grid 자체에서 나오고, 길이 prior의 효과는 작다.

### Cited Findings
- 정답 annotation 자체를 가장 가까운 추정 downbeat에 정렬했을 때의 F-measure (Marmoret et al. 2023, Table 1):

  | 데이터셋 | F0.5s | F3s |
  |---|---|---|
  | RWC Pop | 96.33% | 99.86% |
  | SALAMI Annotation 1 | 82.30% | 99.74% |
  | SALAMI Annotation 2 | 80.94% | 99.88% |

  즉 RWC Pop 경계는 거의 정확히 downbeat 위에 있다. SALAMI의 손실은 bar 추정 오류이거나 비-downbeat 경계 때문이다. 이 상한(≈80%)은 당시 SOTA F0.5s ≈54%(Grill & Schlüter 2015)보다 훨씬 높다 — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- MSAF의 Foote, Spectral Clustering(McFee & Ellis 2014), Structural Features(Serrà 2014) 결과를 가장 가까운 downbeat로 정렬하면 F0.5s가 "크게 증가"하고 F3s는 비슷하다(SALAMI, RWC Pop 모두). 예: Foote RWC Pop F0.5s 27.29%→36.52%(+9.2pt), SALAMI 29.21%→33.33%(+4.1pt) — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- 구간 길이 분포: RWC Pop(MIREX10 annotation)은 절반 이상이 8마디다. SALAMI는 4, 8, 12, 16마디가 비교적 고르게 분포한다 — 같은 출처 (Fig. 8)
- penalty 함수 두 가지:
  - target-deviation `p(n)=|n−τ|^α`: Sargent et al. 2016은 32 beat를 target으로 썼고, 이 논문의 barwise 설정에서는 τ=8, α∈{0.5,1,2}.
  - "modulo 8": n=8이면 0, n≡0 (mod 4)이면 1/4, n≡0 (mod 2)이면 1/2, 그 외 1. 값은 "직관적으로 설정"되었다.

  — 같은 출처
- SALAMI-train, RBF SSM + 7-band kernel에서 penalty별 결과 (Table 7):

  | penalty | F0bar | F1bar |
  |---|---|---|
  | 없음 | 45.81% | 61.81% |
  | target-deviation α=2 | 44.43% | 61.46% |
  | modulo 8 (λ=0.04) | 46.63% | 61.72% |

  α가 크면 오히려 나빠진다. 16마디 구간이 강하게 벌점을 받기 때문이다(|8−16|^α) — 같은 출처
- 최종 test 결과, CBM + modulo 8 (Table 8 / Table 9):

  | 데이터셋 | F0bar | F1bar | F0.5s | F3s |
  |---|---|---|---|---|
  | SALAMI-test | 45.44% | 60.09% | 42.00% | 60.61% |
  | RWC Pop | 65.17% | 81.02% | 64.44% | 80.64% |

  저자 평가: bar 위치만 알면 supervised SOTA와 경쟁할 수준이다 — 같은 출처
- 주의할 편향: downbeat 위에 경계를 두는 방법과 baseline을 비교할 때는 baseline도 downbeat에 정렬해야 공정하다(저자들도 그렇게 통제했다). 또한 bar-tolerance 지표(F0bar, F1bar)는 absolute-time 지표와 다르므로 둘을 함께 보고해야 한다 — [arXiv 2311.18604](https://arxiv.org/pdf/2311.18604)
- DJ 및 실무 관점에서 drum fill은 보통 8마디 또는 16마디 phrase의 끝을 표시한다(비학술 출처) — [mixgraph glossary](https://www.mixgraph.io/glossary/fill)

### Inferences
- 우리 파이프라인은 downbeat가 신뢰 가능하다. 그러면 후보 경계를 처음부터 downbeat 집합으로 제한하는 것(탐색 공간 축소)이 "사후 snap"보다 일관되고, CBM식 DP에 그대로 맞물린다.
- 워십곡은 8마디가 압도적이지만 vamp, tag, 인터루드는 2, 4, 6마디나 반복 횟수 가변 구간이 흔하다. 그래서 target-deviation(τ=8, 큰 α)보다는 약한 modulo-4/8 prior가 안전하다. λ는 우리 데이터 일부로 튜닝해야 한다(논문 기준 λ=0.04, SALAMI-train에서 튜닝).
- 라이브의 pickup(못갖춘마디)이나 보컬이 bar 앞에서 들어오는 anacrusis 때문에 "가사 시작 시점 ≠ 섹션 downbeat"인 경우가 많다. 경계는 downbeat에 두되, STT 단어 시작 시각은 "다음 downbeat로 올림" 규칙과 함께 쓰는 것이 자연스럽다(추론).

### Gaps
- 4/8/16 이외의 박자 구조(6/8 워십 발라드, 2마디 단위 tag)에서 modulo prior의 효과는 측정된 자료가 없다.

## 5. Vocal activity, 악기 구성, drum fill, 에너지 build-up

### Takeaway
분리된 vocal stem 에너지로 instrumental intro, interlude, outro를 찾는 것은 lyrics alignment 분야에서는 흔한 전처리다. 그러나 이를 구조 경계 검출에 적용해 성능을 잰 연구는 찾지 못했다. drum fill 검출은 MIR에서 연구가 적다(라벨 데이터 부족). 워십/CCM을 다룬 MIR 데이터셋이나 논문은 찾지 못했다.

### Cited Findings
- lyrics alignment 전처리 예: vocal을 분리한 뒤 log-energy(MFCC 0차)로 voice activity 구간을 정하고, 짧은 무음은 병합한다(임계값은 경험적으로 설정). 반복되는 가사 때문에 정렬 오류가 누적되므로 lyrics 기반 20-gram LM으로 단어 순서를 강하게 제약한다 — [arXiv 2102.09202](https://arxiv.org/pdf/2102.09202)
- 옛 정렬 시스템(Lyrically)은 "verse와 chorus에만 보컬이 있다"고 가정하고 chorus 검출을 먼저 수행했다. 그래서 bridge와 outro 보컬은 정렬하지 못했다 — [arXiv 1701.06078](https://arxiv.org/pdf/1701.06078v2)
- Demucs v4(Hybrid Transformer, `htdemucs_ft`)는 vocals, drums, bass, other 4 stem을 분리한다 — [Demucs README](https://cdn.jsdelivr.net/gh/facebookresearch/demucs@main/README.md)
- drum fill: NTU 연구에 따르면 fill은 라벨 데이터 부족으로 MIR에서 거의 연구되지 않았다. 이 연구는 두 방법을 제안한다. 하나는 velocity feature와 VAE latent를 쓰는 logistic regression이고, 다른 하나는 인접 bar 대비 노트 차이가 충분하면 그 bar를 fill로 보는 rule 기반 방법이다(symbolic 기반으로 보임) — [NTU scholars](https://scholars.lib.ntu.edu.tw/handle/123456789/635995)
- Turnbull(ISMIR 2007): boundary 단서는 timbre, harmony, melody 변화(새 악기 투입, 전조 등)이고, 주요 접근은 edge detection과 self-similarity다 — [Turnbull slides](https://www.cs.swarthmore.edu/~turnbull/Papers/Turnbull_MusicBoundary_ISMIR07_slides.pdf)
- 워십 관련 MIR 자료는 없었다. ISMIR에는 에티오피아 정교회 성가, 중세 성가, 코랄 등 "성가" 연구만 있었다. contemporary congregational song 연구는 CCLI 상위곡과 YouTube 녹음을 쓴 인문학/민족지 연구(Thornton 2020, Palgrave)와 CCLI 70곡 대 팝 1위곡 비교 학위논문 정도였다 — [ISMIR 2024 poster 160](https://ismir2024program.ismir.net/poster_160.html), [Thornton 2020](https://www.ciando.com/ebook/bid-2918357-meaning-making-in-the-contemporary-congregational-song-genre/), [SBTS repository](https://repository.sbts.edu/handle/10392/6255)
- 워십 편곡 섹션 표기 관행:
  - Musicademy(Worship Backing Band) 약어: B=Bridge, T=Tag, AL=Ad-lib, R=Reprise, E=Ending. 번호가 다른 verse가 같은 가사를 쓰되 다이내믹만 다를 수 있다 — [Musicademy](https://www.musicademy.com/blog/song-section-abbreviations-worship-backing-band/)
  - Planning Center sequence label은 Verse/Chorus/Bridge 기본에 custom label(예: Intro, Instrumental, Vamp, Ending)을 쓴다. SongSelect는 단일 후렴도 "Chorus 1"로, PCO는 "Chorus"로 부르는 등 도구마다 라벨이 다르다 — [Planning Center: Edit song sequences](https://help.planningcenter.com/en/edit-song-sequences.html), [Renewed Vision support](https://support.renewedvision.com/hc/en-us/articles/360062444614)

### Inferences
- 워십 특유의 dynamics 단서들이 있다. (1) "verse 2와 verse 1은 가사는 다르고 화성은 같다." (2) "같은 가사의 chorus가 낮은 다이내믹(down chorus)과 풀 밴드(big chorus)로 반복된다." (3) "bridge는 반복될수록 build-up된다." 이 때문에 loudness/RMS 곡선과 drum stem 에너지가 섹션 경계보다 같은 섹션 내부 변화를 반영하는 경우도 많다. 에너지 변화점은 경계 후보로만 쓰고, 최종 판단은 반복 구조(SSM)와 가사로 하는 것이 안전하다(추론).
- 반대로 vocal stem 에너지가 거의 0인 bar 연속 구간(≥2마디)은 Intro/Interlude/Instrumental/Outro 라벨의 강한 증거다. Whisper 타임스탬프 공백과 교차 확인하면 hallucination(Whisper가 무음 구간에서 가사를 만들어내는 현상)도 걸러낼 수 있다(추론).
- drum fill은 audio 기반 검출기가 공개되어 있지 않다. 대안은 "섹션 직전 bar의 drum stem onset 밀도 급증"을 단순 휴리스틱으로 쓰는 것이다(추론, 검증 필요).

### Gaps
- vocal stem 기반 instrumental 구간 검출이 structure boundary F-measure에 주는 정량 효과는 찾지 못했다.
- 워십/CCM, "반복성이 큰 곡(repetitive songs)", 라이브 예배 녹음을 다룬 MIR 논문이나 데이터셋은 찾지 못했다.
- MultiTracks, Loop Community의 섹션 분류 체계 공식 문서는 이번에 확인하지 못했다.

## 6. 가사/텍스트 단서: lyrics-audio 결합 구조 분석

### Takeaway
가사 텍스트와 오디오는 서로 다른 구조 정보를 담고 있어, 결합하면 lyrics segmentation F가 67.4%(텍스트만)에서 75.3%(텍스트+오디오)로 오른다(Fell et al.). 우리는 Whisper 단어 타임스탬프가 있다. 그래서 줄 단위 텍스트 SSM(반복 줄 = chorus)과 bar 단위 오디오 SSM을 결합하는 구성이 바로 가능하다.

### Cited Findings
- Fell et al., "Lyrics segmentation via bimodal text–audio representation", Natural Language Engineering(2022): 최고 text+audio 모델의 F-score는 75.3%(4.8k곡 synchronized dataset)이고, 텍스트만 쓴 모델은 67.4%(103k lyrics)였다. 결론은 텍스트와 오디오가 서로 다른 구조 정보를 담는다는 것이다. 방법은 phonetic/syntactic 반복 기반 SSM feature를 넣는 CNN이다 — [Cambridge NLE abstract](https://www.cambridge.org/core/journals/natural-language-engineering/article/abs/lyrics-segmentation-via-bimodal-textaudio-representation/E54E76EE0348B48A0951365ACE66D116), [IP Paris portal](https://researchportal.ip-paris.fr/en/publications/lyrics-segmentation-via-bimodal-text-audio-representation/), [HAL](https://hal-cnrs.archives-ouvertes.fr/S2A/hal-03295581v1)
- 이 계열의 선행 연구: Fell et al.(COLING 2018, C18-1174)은 줄 단위 반복 SSM으로 lyrics segmentation을 하고, Watanabe et al.(2016)의 반복 패턴 기반 경계 검출을 따라 "줄마다 경계인지 아닌지"를 판정하는 이진 분류로 정식화했다 — [ACL Anthology C18-1174](https://preview.aclanthology.org/fix_video/C18-1174.pdf), [arXiv 1912.02477 (WASABI)](https://arxiv.org/pdf/1912.02477)
- 2005 ACM Multimedia 논문: 가사 텍스트와 오디오를 결합해 verse/chorus를 찾고 가사를 singing phrase로 나눈다. 여러 언어의 karaoke 20곡에서 audio-only 방법보다 나았다 — [qibin2005_acmmm.pdf](https://www.ee.columbia.edu/~qibin/papers/qibin2005_acmmm.pdf)
- 반복 가사는 정렬 시 오류가 누적되는 원인이다. 이 때문에 n-gram LM 같은 강한 순서 제약이 필요하다 — [arXiv 2102.09202](https://arxiv.org/pdf/2102.09202)

### Inferences
- 워십곡은 같은 가사 줄의 반복이 극단적으로 많다(후렴 x N, tag 1줄 x 7 등). 그래서 텍스트 SSM의 chorus 블록이 매우 선명하다. 반면 Whisper는 반복 구간에서 줄을 누락하거나 반복 hallucination을 일으킬 수 있다(일반적으로 알려진 Whisper 거동이지만 이번에 출처로 확인하지는 않았다). 그러므로 텍스트 단서는 오디오 SSM의 보조로 쓰는 것이 맞다.
- 구현 아이디어(추론):
  1. 각 STT segment 또는 단어 시작 시각을 가장 가까운 downbeat가 속한 bar 번호로 매핑해 bar→text를 만든다.
  2. bar 또는 줄 단위로 텍스트 유사도(정규화한 한글 문자열의 edit distance, 또는 자모/음절 n-gram Jaccard)를 계산해 text-SSM을 만든다.
  3. 오디오 SSM과 가중합하거나 max를 취해 CBM/Foote에 넣는다.
- 장점: 전조된 마지막 후렴도 가사가 같으므로 text-SSM에서는 그대로 매칭된다. 1절의 전조 문제를 우회하는 독립 단서가 된다.

### Gaps
- 한국어 가사, 또는 STT 결과(정답 가사 아님)를 구조 분석에 쓴 정량 연구는 찾지 못했다.
- Watanabe et al. 2016 원문의 수치는 직접 확인하지 못했다.

## 7. 한국 CCM, 찬양 및 아시아권 데이터셋과 선행 연구

### Takeaway
한국 찬양/CCM이나 K-pop 송폼 annotation 데이터셋은 찾지 못했다. 가장 가까운 것은 SongFormer의 중국어 100곡 벤치마크(SongFormBench-CN)와 다국어 학습셋 SongFormDB다. 비영어 팝에서도 SOTA 모델이 HR.5F 0.69 수준이다.

### Cited Findings
- SongFormBench: HarmonixSet 200곡 + 중국어 팝 100곡, 7-class 라벨. 저자들은 이를 "첫 중국어 MSA 데이터셋"이라 부른다. SongFormDB는 10k곡 이상이며, YouTube 기반 부분은 47개 언어에 걸쳐 있다(한국어 포함 여부는 명시되지 않음) — [HF SongFormBench](https://huggingface.co/datasets/ASLP-lab/SongFormBench), [arXiv 2510.02797](https://arxiv.org/pdf/2510.02797)
- KAIST의 K-pop 데이터셋은 singing voice auto-tagging(70 tag)용이며 송폼 데이터셋이 아니다 — [KAIST dspace](https://dspace.kaist.ac.kr/handle/10203/237880)
- 일반 구조 데이터셋: SALAMI(약 1,400곡, 2,400개 이상 annotation), Quaero/Metiss(380개 이상 팝 annotation). 한국 곡 포함 여부는 확인되지 않았다 — [SALAMI ISMIR 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf), [Quaero/Metiss HAL](https://hal.inrae.fr/QUAERO/hal-00931859v1)

### Inferences
- 우리 500곡은 그 자체로 이 분야 최초의 한국 찬양 구조 데이터가 될 가능성이 높다. 평가할 때는 Marmoret et al.의 F0bar/F1bar(bar tolerance)와 F0.5s/F3s를 함께 보고해야 SALAMI, RWC Pop 수치와 비교할 수 있다.
- SongFormer(코드 공개, MuQ/MusicFM 기반)는 Kaggle에서 baseline으로 돌릴 수 있는 가장 최신 공개 모델이다. 단 420초 truncation이 있으므로 라이브곡에는 chunking이 필요하다.

### Gaps
- 한국어 찬양 또는 CCM 구조 분석 선행 연구는 찾지 못했다(한국어 검색은 이번에 수행하지 못함. 국내 학술지 RISS/KCI 검색이 다음 단계).
- SongFormDB에 한국어 곡이 얼마나 들어 있는지는 확인하지 못했다.
