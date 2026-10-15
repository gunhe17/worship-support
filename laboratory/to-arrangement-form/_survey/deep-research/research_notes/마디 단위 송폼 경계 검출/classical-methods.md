# 고전적(비딥러닝/2020 이전) 음악 구조 경계 검출 — 마디/다운비트 그리드 관점

> 지표 표기: HR@0.5s = F0.5, HR@3s = F3 (mir_eval hit-rate F-measure). 별도 언급 없으면 곡별 F를 평균한 값.
> 데이터셋 주석 세트 구분: Beatles-TUT(= Serrà의 BEATLES-A, 174곡, Paulus/TUT 정제판) / BEATLES-B(Isophonics, 180곡) / RWC-Pop-A(AIST 주석) / RWC-Pop-B(MIREX10 주석, 경계만) / SALAMI(MIREX12 일부 등).

## 1. Foote novelty (checkerboard kernel on SSM)

### Takeaway
Foote 커널은 "동질성(homogeneity)" 원리에 기반한 가장 단순한 기준선이다. MSAF 기본값은 beat-synchronous 특징 위에 66-beat 가우시안 체커보드 커널을 쓴다. 단독 성능은 F0.5 ≈ 0.25–0.29, F3 ≈ 0.54–0.58(SALAMI-test/RWC-Pop) 수준이다. 그러나 **마디(bar) 단위 표현 + 다운비트 정렬**을 하면 F0.5가 크게 오른다(RWC-Pop 27.3% → 43.3%, Barwise TF).

### Cited Findings
- 방법: SSM 주대각선을 따라 체커보드 커널을 컨볼루션해 novelty curve를 얻고, peak picking으로 경계를 뽑는다. 동질적 구간 사이의 대비가 SSM에서 체커보드 블록 구조로 나타나는 점을 이용한다(Foote, ICME 2000) — [FMP C4S4](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html)
- FMP 예제는 chroma + feature smoothing(`L=81, H=10`) 위에서 novelty를 계산한다 — [FMP C4S4](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html)
- MSAF Foote 기본 설정: `M_gaussian=66`(커널 크기, beat 단위), `m_median=12`(특징 median filter), `L_peaks=64`(peak picking 창), `bound_norm_feats="min_max"`. 주석 처리된 frame 기반 대안값은 커널 28 s, median 12 s, peak 창 18 s — [MSAF foote/config.py](https://raw.githubusercontent.com/urinieto/msaf/main/msaf/algorithms/foote/config.py)
- Marmoret et al.은 MSAF Foote를 beat-sync에서 커널 66, bar-sync/Barwise TF에서 커널 16(마디)으로 사용했다 — [Marmoret, Cohen, Bimbot 2023 TISMIR (arXiv 2311.18604)](https://arxiv.org/abs/2311.18604)
- Nieto et al. 2020 리뷰는 Foote가 단순하고 효과적이지만 경계가 정답에서 "1초 이상" 어긋나는 경우가 있다고 지적한다 — [Nieto et al. 2020 TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.54)
- 특징 선택(MSAF 실험, Beatles-TUT, beat-sync, HR@3 기준): 경계 검출에서는 음색 특징(CQT, MFCC)이 피치 특징(PCP, Tonnetz)보다 약간 우세하고, 군집(labeling)에서는 반대다. 특징의 효과는 유의하다(two-way ANOVA F(3,3460)=4.20, p<0.01). 수치는 그래프로만 제시된다(경계 F3 축 범위 대략 0.45–0.75) — [Nieto & Bello 2016 ISMIR](https://archives.ismir.net/ismir2016/paper/000043.pdf)
- 시간 해상도별 Foote 성능(Marmoret 2023, Table 2/3; beat 추정은 madmom Böck 2019):

  | 데이터셋 | 설정 | F0.5 | F3 |
  |---|---|---|---|
  | SALAMI-test(485곡, Ullrich 2014 분할) | Beat-sync 원본 | 29.21% | 54.02% |
  | | 원본 → 다운비트 재정렬 | 33.33% | 53.78% |
  | | Bar-sync 특징 | 35.97% | 55.57% |
  | | Barwise TF matrix | 39.67% | 60.36% |
  | RWC-Pop(100곡) | Beat-sync 원본 | 27.29% | 57.95% |
  | | 원본 → 다운비트 재정렬 | 36.52% | 57.44% |
  | | Bar-sync 특징 | 32.46% | 51.97% |
  | | Barwise TF matrix | 43.30% | 65.04% |

  — [Marmoret et al. 2023](https://arxiv.org/abs/2311.18604)
- 같은 논문의 결론: bar-sync(마디당 특징 1개로 평균)는 SALAMI에서 개선되고 RWC-Pop에서 오히려 하락했다. 마디 내부 시간 구조를 보존한 Barwise TF(마디당 고정 샘플 수로 재샘플한 스펙트로그램)는 두 데이터셋 모두에서 개선됐다 — [Marmoret et al. 2023](https://arxiv.org/abs/2311.18604)

### Inferences
- 마디 평균(bar-sync mean pooling)은 정보 손실이 있어 데이터셋에 따라 손해를 본다. 마디 내부를 펼친(TF) 마디 벡터가 더 안전한 선택이다. 우리 파이프라인(Beat This!+DBN 다운비트가 신뢰 가능)에서 Foote-TF는 구현 비용이 가장 낮은 강한 기준선이다.
- 마디 그리드에서는 커널 크기를 마디 단위(예: 16마디, 즉 한쪽 8마디)로 잡는 것이 자연스럽다. 66 beats ≈ 16.5마디(4/4)이므로 MSAF 기본값과도 대략 맞는다.

### Gaps
- Beatles-TUT/Isophonics/Harmonix에서 Foote 단독 수치표를 1차 출처로 확보하지 못했다(MSAF 2016은 그래프만 제공). Harmonix에서의 Foote 수치는 찾지 못했다.
- 체커보드 커널 크기별 성능 곡선(정량)은 1차 출처를 확보하지 못했다.

## 2. Recurrence plot / Structure Features (Serrà et al. 2012/2014), time-lag

### Takeaway
SF는 frame 단위 HPCP에 delay embedding → kNN 재귀행렬 → time-lag 변환 → 가우시안 평활 → 행 차분 novelty를 적용한다. HR@3에서 고전 방법 중 가장 강하다(Beatles-A F3 0.745~0.753, RWC-Pop-A 0.785, RWC-Pop-B 0.797). 다만 HR@0.5에서는 Laplacian/OLDA에 밀린다.

### Cited Findings
- 파이프라인: 특징(HPCP) delay coordinates(m, τ) → kNN 재귀 플롯 R(κ = 이웃 비율) → circular time-lag 행렬 L → 2D 가우시안 커널 G(시간축 st, lag축 sl) 평활 → "structure features" → 연속 프레임 간 차이로 novelty c → peak picking(δ, λ). 기본값: τ=1, sl=0.3 s, δ=0.05, λ=6 s(최소 세그먼트 3 s), st≈30 s(유효 길이 ≈15 s로 평균 경계 간격과 비슷), m은 0–5 s, κ는 0.01–0.05 — [Serrà et al. 2014 IEEE TMM (preprint)](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- 데이터 통계(평균 경계 수 / 평균 경계 간격): BEATLES-A 8.2개 / 17.2 s, BEATLES-B 9.2 / 16.0 s, RWC-Pop-A 16.1 / 14.1 s, RWC-Pop-B 16.8 / 13.7 s — [Serrà 2014](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- Serrà 2014는 "일부 주석이 0.5 s 해상도로 정확하지 않다"는 이유로 **F3만** 보고한다 — [Serrà 2014](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- 경계 F3(FB) 결과(Serrà 2014 Tables II–V):

  | 데이터셋 | Baseline1(랜덤 N개) | Baseline2(3 s마다) | 기존 최고 | SF 최고 | Human |
  |---|---|---|---|---|---|
  | BEATLES-A | 0.427 | 0.505 | Peiszer 0.617, Levy&Sandler 0.581, Paulus&Klapuri 0.550 | 0.753 (SF(3,0.04,35)); 0.745 (SF(2.5,0.03,32)) | 0.911 |
  | BEATLES-B | 0.471 | 0.516 | — | 0.774 | 0.911 |
  | RWC-Pop-A | 0.443 | 0.576 | Peiszer 0.680, Paulus&Klapuri 0.630 | 0.785 | 0.899 |
  | RWC-Pop-B | 0.476 | 0.569 | Kaiser 0.661, Sargent 0.628 | 0.797 | 0.899 |

  — [Serrà 2014](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- 의미 없는 "3 s마다 경계" 기준선이 F3 0.505–0.582를 얻는다. 따라서 F3만 보고 해석하면 위험하다 — 같은 출처
- Ablation(BEATLES-A): delay embedding(A1)을 끄면 FB는 0.693으로 유지되지만 라벨 FL이 0.540으로 무너진다. 구조 특징 블록 없이 HPCP로 직접 novelty를 구하면(A1+A2+A3 off) FB 0.514로 랜덤 수준이다 — 같은 출처 Table IX
- MIREX 2012 보고(Serrà Table VII, 열 순서: MIREX09 / RWC-B / RWC-A / MIREX12): SF(2.5,0.03,32) 0.653 / 0.766 / 0.675 / 0.581; Kaiser et al. 0.572 / 0.661 / 0.605 / 0.531; Martin et al. 0.556 / 0.545 / 0.583 / 0.572. 표 캡션은 "Best FL"이라고 하지만, RWC-B는 경계 주석만 있으므로 경계 F3로 보이는 값이 섞여 있다. 해석에 주의해야 한다 — 같은 출처
- MSAF 비교: SF는 HR@3에서 1위지만 HR@0.5에서는 Laplacian·OLDA에 밀린다(Friedman 검정 F(6)=200.13 / 210.67, p<0.01). 저자 결론은 "정밀한 위치가 필요 없으면 SF, 정밀(HR0.5)이 필요하면 Laplacian" — [Nieto & Bello 2016](https://archives.ismir.net/ismir2016/paper/000043.pdf)
- SF와 C-NMF는 원 논문 권장 특징(PCP)보다 CQT에서 더 좋았다 — [Nieto & Bello 2016](https://archives.ismir.net/ismir2016/paper/000043.pdf)
- 다운비트 재정렬 효과(MSAF SF, Marmoret Fig.4/13 그래프 판독): RWC-Pop F0.5 30.45% → 42.96%, F3 62.91% → 62.15%. SALAMI-test F0.5 ≈30.1% → ≈33.8%(F3 ≈54%로 변화 미미) — [Marmoret et al. 2023](https://arxiv.org/abs/2311.18604)
- Nieto 2020: beat-synchronous 특징을 쓰면 반복이 SSM에서 "완전한 대각선"이 되어 반복 추출이 쉬워진다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)

### Inferences
- SF의 sl(lag 평활)·st(시간 평활)는 초 단위라서 마디 그리드에서는 "마디 수"로 다시 표현할 수 있다(st≈30 s ≈ 128 BPM에서 16마디). 반복(후렴 재등장) 기반이므로 후렴 반복이 많은 찬양곡에 유리할 것으로 추정한다.
- 최소 세그먼트 3 s 제약은 마디 그리드에서 "최소 1–2마디"로 바꾸는 것이 자연스럽다.

### Gaps
- SF의 F0.5 수치는 원 논문에 없다(저자가 의도적으로 보고하지 않음). Harmonix 수치도 없다.
- 2012 AAAI 원 논문 수치는 확인하지 못했다.

## 3. Spectral clustering / Laplacian segmentation (McFee & Ellis 2014)

### Takeaway
beat-sync CQT 반복 그래프와 MFCC 국소 연결 그래프를 결합하고, 그 Laplacian 고유벡터로 계층적 분할(m=2..10)을 한 번에 얻는다. 자동 m 선택 시 Beatles-TUT F0.5 0.312 / F3 0.579, SALAMI(functions) 0.304 / 0.455다. MSAF 비교에서 **HR@0.5 기준 고전 방법 중 가장 정밀**하다.

### Cited Findings
- 구현: 22050 Hz, FFT 2048 / hop 512. log-power CQT 72 bins(C2–C8)를 **검출된 beat 사이에서 평균**(beat-sync)하고 1-step time-delay embedding을 적용한다. 유사도는 가우시안 커널(σ² = k번째 최근접 이웃까지의 평균 제곱거리, k = 1+⌈2 log2 n⌉)이다. kNN 재귀 그래프에서 **3 beats 이내 이웃 연결은 금지**한다("같은 마디 내부의 자기연결 방지" 목적). majority-vote(대각 필터) 창은 w=17이다. 국소 연결은 MFCC 유사도로 만든다. 정규화 Laplacian L = I − D^{-1/2} A D^{-1/2}의 하위 m개 고유벡터로 경계와 라벨을 구한다 — [McFee & Ellis 2014 ISMIR](https://archives.ismir.net/ismir2014/paper/000319.pdf)
- Table 1(Beatles-TUT, 174곡, F0.5 / F3): L2 0.307/0.429, L3 0.303/0.544, L4 0.307/0.568, L5 0.276/0.553, L10 0.214/0.425. 자동 선택 L 0.312±0.15 / 0.579±0.16(Fpair 0.628), 오라클 L* 0.414 / 0.684, 비교 대상 SMGA(Serrà) 0.293 / 0.699 — [McFee & Ellis 2014](https://archives.ismir.net/ismir2014/paper/000319.pdf)
- Table 2(SALAMI functions, 735곡): L 0.304 / 0.455(Fpair 0.546), L* 0.406 / 0.579, SMGA 0.224 / 0.550 — 같은 출처
- 주의: MSAF 논문은 McFee 2014가 첫/마지막 경계를 제거한 비표준 평가를 썼다고 지적한다 — [Nieto & Bello 2016](https://archives.ismir.net/ismir2016/paper/000043.pdf)
- SALAMI(small-scale) 주석에서는 자동 m 선택이 고정 m보다 "dramatically worse"였다. 계층 레벨 선택이 핵심 약점이다 — [McFee & Ellis 2014](https://archives.ismir.net/ismir2014/paper/000319.pdf)
- Laplacian은 반복(repetition) 원리를 선호하며, 다층 고유벡터 인코딩으로 계층 구조를 표현한다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)
- 다운비트 재정렬(MSAF 구현, Marmoret Fig.4/13 그래프 판독): RWC-Pop F0.5 29.44% → 45.01%, F3 58.12% → 60.3%. SALAMI-test F0.5 ≈29.2% → ≈33.7% — [Marmoret et al. 2023](https://arxiv.org/abs/2311.18604)
- 2차 진술: 이 방법이 MIREX 2016 structural segmentation에서 blind(비지도) 방법 중 최고 성능이었다 — [arXiv 2110.14437](https://arxiv.org/pdf/2110.14437) (검색 스니펫 기반, 원문 미확인)

### Inferences
- 다운비트 재정렬로 얻는 이득이 가장 큰 방법이다(RWC F0.5 +15.6pt). 반복 그래프의 노드를 beat 대신 **마디**로 두고 "같은 마디 내부 연결 금지" 같은 설계를 마디 단위로 바꾸면, 자연스럽게 마디 그리드 알고리즘이 된다. 계층 출력(m별 분할)은 마디별 송폼 라벨의 후보 집합을 만드는 데 유용하다.

### Gaps
- librosa 공식 예제 페이지(plot_segmentation)에 접속하지 못해(404) 예제 파라미터를 확인하지 못했다.
- Harmonix/Isophonics 전체에서의 Laplacian 수치는 찾지 못했다.

## 4. 기타 고전 방법 (C-NMF, 2D-FMC, OLDA, Levy & Sandler, Paulus & Klapuri, Sargent 규칙성) 및 MSAF 비교

### Takeaway
MSAF(2016)는 경계 알고리즘 7종(Foote, SF, Laplacian, OLDA, C-NMF, SI-PLCA, Constrained Clustering)과 군집 알고리즘 5종을 비교했다. 기본 설정은 beat-sync PCP와 Beatles-TUT이며, 결과는 **수치표 없이 그래프로만** 제시한다. 요약하면 HR@3은 SF가 1위, HR@0.5는 Laplacian/OLDA가 우세하다. 2D-FMC는 경계가 아니라 라벨링 알고리즘이다.

### Cited Findings
- MSAF 실험 기본값: sr 11025 Hz, FFT 2048 / hop 512, beat-sync PCP(7옥타브, 27.5 Hz부터), MFCC 14개, CQT 87 bins, 경계 지표 HR@3, 기본 데이터셋 Beatles-TUT. 데이터셋: Isophonics 298곡, SALAMI(절반만 사용), Beatles-TUT 174곡, Cerulean, Epiphyte, Sargon, SPAM(신규 50곡, 5인 주석) — [Nieto & Bello 2016](https://archives.ismir.net/ismir2016/paper/000043.pdf)
- MSAF 실험은 beat-sync 특징만 사용했다("템포 불변성, 벡터 수 감소"). 프레임 특징도 지원은 한다 — 같은 출처
- 경계 품질이 군집 성능에 유의한 영향을 준다(F(7,6920)=183.10). 2D-FMC는 추정 경계에 비교적 강건하다. SF 경계가 HR@3 최고여도 군집 결과까지 최상은 아니다 — 같은 출처
- C-NMF(Nieto & Jehan)는 기존 NMF 계열을 능가한다. 2D-FMC(Nieto & Bello 2014)는 정답 경계를 쓸 때 세그먼트 유사도 SOTA다. OLDA(McFee & Ellis 2014b, SF에 학습된 선형 투영)는 "더 정밀한 결과"를 낸다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)
- Levy & Sandler(HMM 기반 상태 군집) BEATLES-A F3 0.581. Paulus & Klapuri(반복/대비 비용의 조합 최적화) BEATLES-A 0.550, RWC-Pop-A 0.630 — [Serrà 2014 Tables II, IV](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- Sargent, Bimbot, Vincent: 세그먼트 길이 사전확률을 넣은 regularity-constrained Viterbi(ISMIR 2011)로, RWC-Pop에서 평가했다. 2016 후속 연구는 regularity 제약으로 MIREX 2010–2015 시스템 출력을 결합해 RWC 100곡에서 SOTA에 견줄 성능을 냈다 — [Sargent et al. ISMIR 2011](https://archives.ismir.net/ismir2011/paper/000105.pdf), [HAL 01403210](https://hal-univ-tlse3.archives-ouvertes.fr/INRIA/hal-01403210) (초록 기반)
- Sargent의 target-deviation 패널티 p(n)=|n−τ|^α는 τ=32 beats(4/4 기준 8마디)로 설정됐다 — [Marmoret et al. 2023](https://arxiv.org/abs/2311.18604)
- 참고(딥러닝 경계): Ullrich, Schlüter, Grill 2014의 CNN이 SALAMI 부분집합에서 F0.5 0.33→0.46, F3 0.52→0.62로 SOTA를 갱신했다 — [JKU 출판 페이지](https://research.jku.at/en/publications/boundary-detection-in-music-structure-analysis-using-convolutiona/) (검색 스니펫)

### Inferences
- 마디 그리드로 옮길 고전 계열 후보의 실용적 우선순위: (1) Foote-TF(가장 단순), (2) Laplacian(정밀하고 계층적), (3) SF(반복 기반, F3 강함), (4) CBM(5절, 마디 네이티브 + 규칙성 패널티).

### Gaps
- MSAF 알고리즘별 정확한 수치표는 논문에 없다(그래프만 있음). github.com/urinieto/msaf-experiments에 있을 수 있으나 확인하지 못했다.
- C-NMF/SI-PLCA/OLDA의 Beatles/RWC 단독 수치는 1차 출처를 확보하지 못했다.

## 5. Beat-sync vs frame 특징, 다운비트 스냅, 4/8마디 프레이즈 사전확률

### Takeaway
가장 직접적인 정량 증거는 Marmoret et al. 2023(TISMIR)이다. (a) 정답 주석을 다운비트에 스냅해도 RWC-Pop은 F0.5 96.3% / F3 99.9%로 거의 손실이 없다. 즉 팝 경계는 다운비트 위에 있다. (b) 기존 알고리즘 출력을 다운비트에 스냅하면 F0.5가 +4~16pt 오르고 F3는 거의 변하지 않는다. (c) 마디 네이티브 CBM에 8마디 modulo 패널티를 더하면 RWC-Pop F0.5 64.4% / F3 80.6%로 비지도 방법 중 최고이며, F3 기준으로 지도 CNN과 경쟁한다.

### Cited Findings
- 주석을 (추정) 다운비트에 스냅했을 때의 상한: SALAMI 주석1 F0.5 82.30% / F3 99.74%, 주석2 80.94% / 99.88%, RWC-Pop 96.33% / 99.86%. RWC 주석은 다운비트에 정확히 놓여 있고, SALAMI는 덜 정확하거나 다운비트 밖 경계가 있다 — [Marmoret et al. 2023 Table 1](https://arxiv.org/abs/2311.18604)
- Harmonix 경계는 항상 주석된 beat 위에 있고, RWC 경계도 항상 beat 위치에 있다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)
- 3 s 허용오차는 Ong & Herrera(2005)에서 "80 BPM 4/4의 약 1마디"로 정당화됐고, 0.5 s는 beat 수준이다. CBM에서 F1bar(1마디 허용)와 F3는 거의 같다(RWC 81.02 vs 80.64, SALAMI 60.09 vs 60.61) — [Marmoret et al. 2023 Table 9](https://arxiv.org/abs/2311.18604)
- 출력 다운비트 스냅(MSAF, RWC-Pop, 그래프 판독): F0.5는 Foote 25.14→34.48, Laplacian 29.44→45.01, SF 30.45→42.96. F3는 각각 54.49→55.01, 58.12→60.3, 62.91→62.15 — [Marmoret et al. 2023 Fig.4/13](https://arxiv.org/abs/2311.18604)
- CBM(Correlation Block-Matching): 마디 단위 SSM을 동적계획법으로 분할하며, 세그먼트 점수 = 블록 내 가중 자기유사도 − 길이 패널티. RBF 유사도가 cosine(과소분할)·autocorrelation(과분할)보다 균형이 좋다. 7-band 커널이 최적이었다(v-band 커널은 v+1마디 세그먼트를 선호) — 같은 출처
- CBM 결과(F0bar / F1bar): 패널티 없이 RWC 62.82/79.81, SALAMI-test 44.33/59.88. **modulo-8 패널티(λ=0.04)**를 쓰면 RWC 65.17/81.02, SALAMI-test 45.44/60.09. 절대시간 지표로는 RWC F0.5 64.44 / F3 80.64, SALAMI-test 42.00 / 60.61 — 같은 출처 Tables 6, 8, 9
- 세그먼트 길이 분포: RWC-Pop(MIREX10 주석)은 절반 이상이 8마디다. SALAMI는 4·8·12·16마디에 고르게 분산된다. 그래서 target-deviation(τ=8)은 16마디를 크게 벌점 주고, modulo-8이 더 적합하다. SALAMI-train에서 modulo-8은 F0bar를 45.81→46.63으로 소폭 올렸고 F1bar는 그대로였다 — 같은 출처 Table 7, Fig.8
- 마디 vs beat 스케일(CBM, 패널티 없음): RWC-Pop Beatwise(cosine, 63-band) F0.5 44.57 vs Barwise(RBF, 7-band) 62.28. F3의 P/R은 Beatwise 72.54/68.85 vs Barwise 75.17/85.90. SALAMI-test F0.5는 37.36 vs 41.04. 마디 정렬의 이득이 있고, 특히 RWC-Pop에서 크다 — 같은 출처 Tables 10, 11
- 비교 기준: 같은 논문은 CNN(Grill & Schlüter 2015, MIREX 2015)의 SALAMI F0.5 ≈54%를 지도 SOTA로 인용한다 — 같은 출처
- MSAF 2016의 모든 실험은 beat-sync로 수행됐다. beat-sync는 벡터 수를 줄이고 템포 불변성을 준다 — [Nieto & Bello 2016](https://archives.ismir.net/ismir2016/paper/000043.pdf)

### Inferences
- 우리 조건(신뢰 가능한 다운비트, 팝 계열 찬양곡, 4/8마디 프레이즈가 지배적일 가능성이 높음)은 RWC-Pop과 가장 비슷하다. 따라서 마디 그리드 + 다운비트 스냅은 사실상 "공짜 이득"이다(F0.5 +10~16pt 예상). F3/1마디 지표는 크게 변하지 않는다.
- 평가도 F0bar/F1bar(마디 허용오차)로 하는 것이 목적(마디별 라벨)에 맞다.
- 8마디 modulo 패널티의 효과는 RWC에서 작았다(F0bar +2.4pt). 프레이즈 사전확률은 보조 수단이지 주된 성능원이 아니다. 찬양곡에 4마디 단위 구조(짧은 브릿지·태그 등)가 많다면 modulo-4나 {4,8,16} 혼합 사전확률을 검토할 필요가 있다(추정).
- 라이브 녹음에서는 후렴 반복 횟수가 가변적이고 인트로/간주 즉흥이 있어 길이 사전확률이 깨지기 쉽다. 패널티 강도(λ)는 작게 두는 것이 좋다.

### Gaps
- Maezawa의 bar-level 구조 분석이나, 4/8마디 프레이즈 그리드를 명시적으로 쓴 다른 연구의 정량 결과는 이번 조사에서 찾지 못했다.
- 같은 알고리즘·같은 데이터에서 frame 특징과 beat-sync 특징을 직접 비교한 수치는 확보하지 못했다(Serrà는 frame HPCP, MSAF는 beat-sync만 사용).

## 6. MIREX Structural Segmentation 결과

### Takeaway
MIREX 최고 성능(2012–2017)은 MIREX09 F0.5 56.4 / F3 70.4, SALAMI 부분집합 54.1 / 68.9(F3는 2014 Ullrich CNN)이다. 최고 경계 성능은 CNN 계열이다. 고전 방법인 SF는 MIREX 2012의 MIREX09·RWC 셋에서 우세했다.

### Cited Findings
- Nieto 2020 Table 1(MIREX 최고값, %): MIREX 2009 F0.5 56.42±17.04 / F3 70.35±14.87; MIREX 2010(1) 69.70±13.59 / 79.34±9.43; MIREX 2010(2) 52.37±17.54 / 73.80±11.68(§Ullrich 2014); SALAMI* 54.09±18.50 / 68.94±17.51(§Ullrich 2014). 인간 성능은 약 90%로 추정된다. MIREX 2010 결과는 과적합으로 부풀려졌을 수 있다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)
- MIREX 2012 경계 F3(Serrà Table VII): SF 0.653(MIREX09), 0.766(RWC-B), 0.675(RWC-A), 0.581(MIREX12/SALAMI). 차순위는 Kaiser 0.572/0.661/0.605/0.531, Martin 0.556/0.545/0.583/0.572. MIREX12(SALAMI)는 모든 알고리즘의 점수가 낮아 주석 기준이 다르다는 의심이 있다 — [Serrà 2014](https://www.iiia.csic.es/media/filer_public/9b/ee/9bee5993-4959-44b9-8b0c-a68412cb3b08/4766.pdf)
- MIREX에서 경계 성능이 가장 좋은 알고리즘들은 deep CNN 기반이다 — [Nieto et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.54)

### Inferences
- 고전 방법의 F3 상한은 팝(RWC/Beatles)에서 ≈0.75–0.80, SALAMI에서 ≈0.55–0.60이다. F0.5는 원래 0.3 안팎으로 낮지만, 다운비트 스냅으로 RWC에서 0.43–0.64까지 개선할 수 있다.

### Gaps
- music-ir.org MIREX 결과 페이지(2016 등)에 접속하지 못해(인증서 오류/404) 연도별 개별 제출(예: MSAF 기반 제출) 수치를 확보하지 못했다.
