# 딥러닝 기반 음악 구조 경계 검출·세그멘테이션 모델 (2014–2026)

> 표기: HR.5F / HR3F = boundary hit-rate F-measure (허용오차 ±0.5 s / ±3 s, mir_eval). F0.5s/F3s도 같은 지표다. ACC = frame-wise 기능 라벨 정확도. PWF = pairwise frame clustering F. Sf = normalized-entropy F. ★ = 해당 표에서 다른 논문 수치를 인용한 값(재실행 아님). 별도 표시가 없으면 저자 자체 평가다.

## 1. 초기 CNN 경계 검출: Ullrich, Schlüter & Grill (ISMIR 2014), Grill & Schlüter (ISMIR 2015)

### Takeaway
Ullrich 2014는 mel 스펙트로그램 CNN으로 SALAMI에서 F@0.5s 0.465, F@3s 0.616을 냈다. 당시 MIREX 2012/13 제출작(≈0.33 / ≈0.52)보다 크게 앞섰다. Grill & Schlüter 2015(SSLM + mel, 2-level annotation, MIREX 2015 "GS3")는 이후 수년간 지도학습 SOTA 기준선이었다. 다만 코드나 가중치를 바로 쓸 수 있는 형태로 공개한 모델은 찾지 못했다.

### Cited Findings
- **Ullrich et al. 2014 구조**: 입력은 log-mel 스펙트로그램 패치다. CNN이 "패치 중앙에 경계가 있는가"를 이진 분류한다. 학습 타깃은 Gaussian으로 smearing하고, 출력 곡선은 peak-picking으로 후처리한다. 테스트셋은 SALAMI 공개 주석과 매칭한 487곡이고, 나머지를 train/validation(100곡)으로 썼다 — [Ullrich et al. 2014 PDF](https://ofai.at/~jan.schlueter/pubs/2014_ismir.pdf)
- **Ullrich 2014 결과 (SALAMI 487곡, 자체 평가)**:
  - ±0.5 s: 최고 모델 `16s_std_1.5s`가 F 0.4646 (P 0.5553, R 0.4583). 비교 대상인 MIREX 최고 MP2(2013)는 F 0.3280이다. 저자 추정 상한은 0.68(인간 주석자 간 일치도 기반), baseline은 0.13이다.
  - ±3 s: 최고 모델 `32s_low_6s`가 F 0.6164 (P 0.5944, R 0.7059). MP2(2013)는 0.5213이고, 추정 상한은 0.76이다.
  - 출처: [Ullrich et al. 2014 PDF, Table 1–2](https://ofai.at/~jan.schlueter/pubs/2014_ismir.pdf)
- **Grill & Schlüter 2015**: Marmoret et al.(TISMIR)은 이를 "global (supervised) state-of-the-art"로 다룬다.
  - SALAMI F0.5s ≈ 54%로 서술하며, 수치는 MIREX 2015 결과에서 인용했다(제3자 인용) — [Marmoret et al., CBM (arXiv 2311.18604)](https://arxiv.org/abs/2311.18604)
  - RWC-Pop(MIREX 2015, Supervised CNN [GS]): P0.5 80.4%, R0.5 62.7%, F0.5 69.7%, P3 91.9%, R3 71.1%, F3 79.3% — [Marmoret et al. 2022, Barwise Compression Table 1](https://arxiv.org/abs/2202.04981)
- **같은 시스템(GS3, MIREX 2015)의 다른 인용 수치**: Wang et al. 2022 표에서 HR.5F .524 / PWF .542 / Sf .684 (RWC-Pop, MIREX 2010 RWC collection), HR.5F .564 / PWF .567 / Sf .686 (Isophonics) — [Wang, Hung, Smith 2022 (arXiv 2205.14700)](https://arxiv.org/abs/2205.14700)
  - RWC-Pop F0.5가 출처에 따라 다르다(69.7% vs .524). MIREX 주석 버전이나 집계 방식 차이로 보이며, 확인하지 못했다.

### Inferences
- 이 계열은 시간 기반 경계 확률 곡선을 내는 모델이다. 마디 그리드에 쓰려면 곡선을 다운비트 위치에서 샘플링하거나, 가장 가까운 다운비트로 스냅하는 후처리가 쉽게 붙는다.
- 다만 2014–15 모델은 공개 가중치가 없다. 실무에서는 재학습이 필요하다.

### Gaps
- Grill & Schlüter 2015 원 논문의 SALAMI F@0.5/F@3 정확한 표 값은 확보하지 못했다. 다운로드 링크에서 다른 논문 PDF가 받아졌다.
- Ullrich/Grill 코드와 가중치의 공식 공개 여부도 확인하지 못했다. 저자 페이지(jan-schlueter.de/pubs/2014_ismir/)에 보조 자료가 있다는 언급만 확인했다 — [CBM 논문 각주](https://arxiv.org/abs/2311.18604)

## 2. All-In-One (Kim & Nam, WASPAA 2023, `allin1`)

### Takeaway
All-In-One은 Demucs 4-stem 분리 스펙트로그램을 입력으로 받는다. 약 300K 파라미터의 neighborhood-attention Transformer 하나가 beat, downbeat, 경계, 10종 기능 라벨을 동시에 예측한다. Harmonix 8-fold CV에서 HR.5F .660을 냈다(자체 평가).

라이선스는 코드와 HF 가중치 모두 MIT로 표기되어 있다. 이번 조사에서 상업 사용에 가장 가까운 공개 모델이다. 다만 학습 데이터 Harmonix와 madmom 의존성은 따로 확인해야 한다.

### Cited Findings
- **구조**
  - 입력: source-separated(demixed) 스펙트로그램.
  - 주의 구조: dilated neighborhood attention(장기 의존)과 non-dilated attention(악기 간 국소 의존)을 함께 쓴다.
  - 데이터: Harmonix Set.
  - joint learning 효과: ablation에서 beat, downbeat, segment를 같이 학습하면 각 과제 성능이 오른다 — [arXiv 2307.16425](https://arxiv.org/abs/2307.16425)
- **구현 세부**: 11개 Transformer 블록을 쓴다. beat/downbeat는 madmom DBN으로 후처리하고, 경계는 peak-picking으로 얻는다. 분리는 Hybrid Transformer Demucs, NA/DiNA 구현은 NATTEN이다. 학습·평가는 8-fold CV(6 train / 1 val / 1 test) — [All-In-One 논문 PDF](https://arxiv.org/pdf/2307.16425)
- **Harmonix Set 결과 (8-fold CV 평균, 자체 평가, Table 1)**:
  | 모델 | 파라미터 | Beat F1 | Downbeat F1 | HR.5F | PWF | Sf |
  |---|---|---|---|---|---|---|
  | All-In-One | 300K | .958 | .915 | .660 | .738 | .769 |
  | All-In-One-Small | 46K | .943 | .901 | .616 | .713 | .745 |
  | TCN-Large (재현) | 301K | .953 | .901 | .626 | .717 | .746 |
  | SpecTNT [Wang 2022] | 인용 | – | – | .558 | .712 | .724 |
  | DSF+Scluster | 인용 | – | – | .497 | .684 | .743 |

  — [All-In-One 논문 PDF](https://arxiv.org/pdf/2307.16425)
  - 이 논문 표에는 HR3F와 ACC(기능 라벨 frame accuracy)가 없다.
- **제3자 평가 (SongFormer 논문, SongFormBench, 공개 inference 코드로 재실행, 7-class로 매핑)**:
  - SongFormBench-HarmonixSet(200곡): ACC 0.740, HR.5F 0.596, HR3F 0.730.
  - SongFormBench-CN(중국 대중가요 100곡): ACC 0.834, HR.5F 0.563, HR3F 0.771.
  - 곡당 추론 시간 9–12 s(L40) — [SongFormer arXiv 2510.02797](https://arxiv.org/abs/2510.02797)
  - 자체 보고치 .660보다 HR.5F가 낮다. 평가셋이 수정된 Harmonix 200곡이고 라벨 매핑이 다르기 때문으로 보인다.
- **출력**:
  - BPM, beat, downbeat, beat position(마디 내 박 번호).
  - segment(start, end, label). 라벨은 start, end, intro, outro, break, bridge, inst, solo, verse, chorus.
  - 옵션으로 100 FPS frame-level activation(beat/downbeat/boundary sigmoid, 10-class softmax)과 24-dim 임베딩을 낸다 — [GitHub mir-aidj/all-in-one](https://github.com/mir-aidj/all-in-one)
- **모델 구성**: `harmonix-all`은 fold별 8개 모델의 앙상블 평균이다. `harmonix-foldN` 단일 모델(N=0–7)도 받을 수 있다 — [GitHub README](https://github.com/mir-aidj/all-in-one)
- **알려진 이슈와 요구사항**:
  - MP3 디코더에 따라 20–40 ms 시간 오프셋이 생긴다. README는 WAV 변환을 권장한다.
  - NATTEN이 필요하다(Linux는 별도 설치, Windows는 소스 빌드).
  - 속도: RTX 4090 기준 10곡(33분)을 73 s에 처리했다 — [GitHub README](https://github.com/mir-aidj/all-in-one)
- **라이선스**
  - 코드: MIT — [GitHub](https://github.com/mir-aidj/all-in-one)
  - 가중치: HF repo `taejunkim/allinone`에서 `hf_hub_download`로 받는다 — [loaders.py](https://raw.githubusercontent.com/mir-aidj/all-in-one/main/src/allin1/models/loaders.py). 이 HF repo의 license 태그는 MIT이고, model card README는 비어 있다 — [HF taejunkim/allinone](https://huggingface.co/taejunkim/allinone)
  - madmom 의존성: 소스 코드는 BSD지만, madmom의 model/data 파일(.pkl, .npy, .h5 등)은 CC BY-NC-SA 4.0이다 — [madmom LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE)

### Inferences
- **마디 그리드 결합**: 경계 activation을 100 FPS로 노출하므로, 외부 다운비트(Beat This! + DBN)에서 곡선을 샘플링하거나 max-pool해 마디 단위 경계 점수를 만들기 쉽다. 내장 downbeat를 버리고 외부 grid를 쓸 수 있다.
- **madmom 라이선스 리스크**: allin1은 DBN 후처리만 madmom 코드(BSD)로 쓰는 것으로 보인다. madmom의 사전학습 모델 파일을 로드하지 않는다면 NC 조항이 걸리지 않을 가능성이 있다. 하지만 이는 코드 확인이 필요한 추정이다.
- **학습 데이터의 권리 문제**: 가중치에 MIT 태그가 붙어 있어도, 학습 데이터 Harmonix는 오디오가 비공개 상업 음원이다. 상업 이용 시 학습 데이터 권리 문제는 법적으로 별도 판단이 필요하다.
- **Kaggle T4 적합성**: 300K 파라미터로 작다. Demucs 분리 비용이 지배적이지만 T4에서 충분히 실행 가능할 것으로 보인다.
- **한국 CCM과의 도메인 차이**: 서양 팝(Harmonix) 단일 학습이다. 다만 중국 대중가요 셋에서 ACC 0.834를 보여 비서양 팝으로 어느 정도 일반화된다.

### Gaps
- 저자 논문에서 Harmonix 기준 HR3F와 기능 라벨 ACC를 확인하지 못했다.
- RWC-Pop, SALAMI, Beatles 평가 수치는 찾지 못했다.
- GitHub open issue 15건의 내용(예: 라벨 오류 패턴)은 확인하지 못했다.

## 3. SongFormer (Hao et al., 2025, ASLP-lab)

### Takeaway
SongFormer는 MuQ와 MusicFM SSL 표현(30 s 창과 420 s 창)을 융합하고, 4-layer Transformer로 경계와 8종 라벨을 예측한다. SongFormBench에서 HR.5F와 ACC 모두 SOTA를 주장한다(자체 평가).

코드는 CC-BY-4.0이지만 MuQ 가중치가 CC-BY-NC 4.0이다. 따라서 파이프라인 전체는 상업적으로 쓸 수 없다.

### Cited Findings
- **구조**
  - 입력: 원 파형에서 MuQ와 MusicFM의 30 s 단기 창, 420 s 장기 창 표현을 뽑아 채널 방향으로 concat한다.
  - 학습: 이질적 라벨 소스(HX, E, H, G)를 구분하는 learned source embedding을 넣어, 부분적·노이즈·스키마가 다른 라벨로 학습한다.
  - 출력 헤드: 4-layer Transformer, hidden 512.
  - 데이터: SongFormDB(1만 곡 이상) 공개, 평가용 SongFormBench(Harmonix 수정본 200곡 + 중국 가요 100곡) — [arXiv 2510.02797 v2 HTML](https://arxiv.org/html/2510.02797v2)
  - SongFormDB 규모는 출처에 따라 "10k+"와 "14k+"로 다르게 표기된다 — [검색 결과 요약/arXiv](https://arxiv.org/abs/2510.02797)
- **라벨**: intro, verse, chorus, bridge, inst, outro, silence, pre-chorus(8종). 평가 시에는 pre-chorus를 verse로 매핑해 7종으로 계산한다 — [GitHub ASLP-lab/SongFormer](https://github.com/ASLP-lab/SongFormer)
- **결과 (자체 평가, Table II, ACC / HR.5F / HR3F)**:
  - SongFormBench-HarmonixSet:
    - SongFormer(HX) .795 / .703 / .784
    - SongFormer(HX+E+H+G) .807 / .696 / .780
    - All-In-One .740 / .596 / .730
    - LinkSeg-7Labels .780 / .630 / .762
    - Gemini 2.5 Pro .748 / .423 / .813
    - TA(Zhang 2025)★ .787 / .610 / .801
    - MusicFM★ .725 / .640 / .729
    - MuQ_iter★ .772 / – / –
    - MERT(5 s)★ .574 / .626 / –
  - SongFormBench-CN:
    - SongFormer(HX+E+H+G) .891 / .688 / .851
    - SongFormer(HX) .848 / .675 / .856
    - All-In-One .834 / .563 / .771
    - LinkSeg .828 / .518 / .757
    - Gemini .806 / .412 / .833
  - RWC-Pop:
    - SongFormer(HX+E+H) .814 / .650 / .804
    - LinkSeg .747 / .648 / .786
    - TA★ .779 / .506 / .691
    - MusicFM★ .680 / .636 / .764
    - SpecTNT★ .675 / .623 / –
  - 출처: [SongFormer PDF](https://arxiv.org/pdf/2510.02797)
  - ★ 수치는 원 논문에서 인용한 값이다. 평가 조건이 다를 수 있다고 저자도 명시한다 — [arXiv HTML](https://arxiv.org/html/2510.02797v2)
- **추론 시간**: 곡당 2–4 s(L40). 비교하면 All-In-One 9–12 s, LinkSeg 3–5 s, Gemini 30–90 s — [SongFormer PDF Table III](https://arxiv.org/pdf/2510.02797)
- **저자가 밝힌 한계**:
  - 외부 데이터를 추가하면 타임스탬프 부정확성 때문에 HR.5F가 약간 떨어진다.
  - CN 벤치는 100곡뿐이다.
  - 출처: [arXiv HTML](https://arxiv.org/html/2510.02797v2)
- **라이선스**
  - SongFormer 코드: README에 "CC-BY-4.0". 가중치와 데이터셋 라이선스는 README에 명시가 없다 — [GitHub](https://github.com/ASLP-lab/SongFormer)
  - MuQ: 가중치(MuQ-large-msd-iter, MuQ-MuLan-large)는 CC-BY-NC 4.0, 코드는 MIT — [HF OpenMuQ/MuQ-large-msd-iter](https://huggingface.co/OpenMuQ/MuQ-large-msd-iter)
  - MusicFM: 코드는 MIT/Apache 배지가 혼재하고, 체크포인트(MSD/FMA) 라이선스는 명시되지 않았다 — [GitHub minzwon/musicfm](https://github.com/minzwon/musicfm)
- **설치 이슈**: MusicFM 로더에서 `torch.load(..., weights_only=False)`로 수정해야 한다. requirements 버전 핀 문제가 있을 수 있다 — [GitHub README](https://github.com/ASLP-lab/SongFormer)

### Inferences
- SongFormer는 beat나 downbeat를 쓰지 않는 frame 기반 모델이다(논문은 beat tracking 같은 전처리 회피를 장점으로 서술). 따라서 마디 그리드와는 후처리 스냅으로만 결합할 수 있다.
- 사용자가 이미 경험한 "라벨 오류 빈발"은 위 ACC 0.8–0.89(frame 정확도)와 모순되지 않는다. frame의 10–20%가 틀리면 곡 단위로는 거의 항상 몇 개 섹션 라벨이 틀린다.

### Gaps
- SongFormer 가중치 자체의 명시적 라이선스는 찾지 못했다.
- SALAMI와 Beatles 평가는 없다.

## 4. Wang et al.: SpecTNT 기능 라벨 MSA ("To catch a chorus…", ICASSP 2022), MuSFA (2022), Temporal Adaptation (2025)

### Takeaway
ByteDance 계열 연구는 "chorusness / verseness" 같은 frame별 기능 확률 곡선과 boundary 곡선을 직접 예측하는 방향을 확립했다. 4개 데이터셋(Harmonix, SALAMI-pop, RWC-Pop, Isophonics)에서 HR.5F, ACC, PWF, Sf, 코러스 지표를 모두 보고한 가장 완결된 수치 세트다. 다만 공개 가중치는 없다.

### Cited Findings
- **"To catch a chorus" (Wang, Hung, Smith, ICASSP 2022)**
  - 모델: SpecTNT(spectral-temporal Transformer) + CTL(connectionist temporal localization) loss. 비교 모델은 Harmonic-CNN.
  - 라벨: 7-class(intro, verse, chorus, bridge, outro, instrumental, silence). 4개 데이터셋 주석을 통합했다.
  - 후처리: boundary 곡선에 peak-picking을 하고, 세그먼트별로 평균 확률이 가장 큰 기능 라벨을 고른다.
  - 출처: [arXiv 2205.14700](https://arxiv.org/abs/2205.14700)
- **결과 (Table 1, 자체 평가)**. 지표 순서는 HR.5F / ACC / PWF / Sf / CHR.5F(코러스 경계) / CF1(코러스 frame F).
  - Harmonix 4-fold CV(다른 3개 셋을 학습에 추가):
    - SpecTNT(24 s, CTL) .570 / .701 / .700 / .714 / .501 / .815
    - SpecTNT(36 s, CTL) .558 / .723 / .712 / .724 / .476 / .831
    - Harmonic-CNN .559 / .680 / .670 / .682 / .462 / .784
    - DSF+Scluster .497 / – / .689 / .743
    - Scluster(McFee & Ellis 2014) .263 / – / .586 / .641
  - Cross-dataset, SALAMI-pop(274곡): SpecTNT .490 / .544 / .651 / .632 / .357 / .811
  - Cross-dataset, RWC-Pop:
    - SpecTNT .623 / .675 / .749 / .728 / .465 / .847
    - GS3(2015) .524 / – / .542 / .684
  - Cross-dataset, Isophonics(Beatles 174곡, TUT 주석):
    - SpecTNT .590 / .550 / .635 / .614 / .401 / .733
    - GS3 .564 / – / .567 / .686
  - 출처: [Wang et al. 2022 PDF](https://arxiv.org/pdf/2205.14700)
  - 저자 관찰 1: 36 s 입력은 라벨 정확도를 올리지만 경계 정확도는 떨어뜨린다.
  - 저자 관찰 2: Beatles에서는 'chorus' 라벨이 적다. 페이드아웃 코러스를 'outro'로 예측하는 오류가 잦다 — [동 PDF](https://arxiv.org/pdf/2205.14700)
- **MuSFA (Wang, Smith, Hung, 2022)**
  - 방법: 부분 라벨 데이터(HLSD)를 추가 학습했다.
  - 결과(HR.5F / ACC / CHR.5F / CF1):
    - SALAMI-pop .532 / .551 / .399 / .820
    - RWC-Pop .643 / .677 / .496 / .850
    - Isophonics .598 / .559 / .411 / .741
  - 출처: [arXiv 2211.15787](https://arxiv.org/abs/2211.15787)
- **Temporal Adaptation (Zhang, Chen, Wang, Chen, ByteDance, arXiv 2507.13572, 2025)**
  - 방법: MusicFM 백본을 fine-tune한다. audio window를 100–270 s로 확장하고 low-resolution adaptation을 적용해 전곡을 single pass로 처리한다.
  - Harmonix 8-fold CV(ACC / HR.5F / HR3F):
    - 150 s 설정 .787 / .610 / .801
    - 100 s 설정 .781 / .599 / .828
    - MusicFM(30 s) .725 / .640 / .729
    - "Morgan et al."(Buisson)★ .742 / .568 / .717
    - MERT(5 s)★ .574 / .626 / –
    - All-in-one★ – / .660 / –
  - Cross-dataset RWC-Pop:
    - 100 s 설정 .748 / .534 / .788
    - Buisson★ .747 / .648 / .786
  - 출처: [arXiv 2507.13572](https://arxiv.org/abs/2507.13572)
  - 저자들은 MuQ의 Harmonix 결과가 비공개 split을 썼다는 이유로 비교에서 제외했다 — [동 논문](https://arxiv.org/abs/2507.13572)

### Inferences
- **경계 정밀도와 라벨 정확도의 trade-off**: 긴 컨텍스트는 라벨 ACC를 올리고 HR.5F를 낮추는 경향이 Wang 2022, TA 2025, SongFormer 세 연구 모두에서 반복된다. 정밀 경계는 외부 다운비트 그리드로 보정하고, 라벨은 장기 컨텍스트 모델로 얻는 분업 설계를 이 패턴이 지지한다.
- **재현성**: SpecTNT와 TA는 공개 inference 코드나 가중치가 없다(SongFormer 저자 서술: "earlier models do not release public inference code") — [SongFormer PDF](https://arxiv.org/pdf/2510.02797). 바로 쓸 수 없다.

### Gaps
- Wang et al. 2021 ("supervised chorus detection", Harmonic-CNN 기반 DSF 등)의 원 논문 수치와 별도 코드 라이선스는 확인하지 못했다.

## 5. Buisson et al.: LinkSeg (ISMIR 2024)와 self-supervised 멀티레벨 표현

### Takeaway
LinkSeg는 SSM의 각 링크를 same-segment / same-section / different로 분류한다. 그다음 graph attention으로 경계와 7종(또는 9종) 라벨을 예측한다. madmom beat 추정 위에서 동작하는 beat-synchronous 계열이다. 체크포인트는 공개되어 있지만 코드와 가중치의 라이선스가 명시되지 않았다.

### Cited Findings
- **구조와 입출력**: Buisson, McFee, Essid, "Using Pairwise Link Prediction and Graph Attention Networks for MSA", ISMIR 2024.
  - 전처리: madmom beat 추정. 경계는 연속 beat 사이에 놓인다.
  - 출력: JAMS. 라벨은 7-class(Intro, Verse, Chorus, Bridge, Instrumental, Outro, Silence), 9-class 옵션은 Pre-chorus와 Post-chorus를 추가한다.
  - 체크포인트: `model_7_classes.pt`, `model_9_classes.pt`가 repo에 포함되어 있다. 7-class 모델은 Harmonix 75% split으로 학습했다.
  - 라이선스: LICENSE 파일이 없다.
  - 출처: [GitHub morgan76/LinkSeg](https://github.com/morgan76/LinkSeg)
- **수치 (ACC / HR.5F / HR3F)**
  - SongFormer 저자가 재실행한 값: SongFormBench-Harmonix .780 / .630 / .762, CN .828 / .518 / .757, RWC-Pop .747 / .648 / .786. 곡당 3–5 s — [SongFormer PDF](https://arxiv.org/pdf/2510.02797)
  - TA 논문이 인용한 원 논문 값: Harmonix CV .742 / .568 / .717, cross-dataset Harmonix .530 / .462 / .664 — [arXiv 2507.13572](https://arxiv.org/abs/2507.13572)

### Inferences
- beat 단위로 경계 후보를 두는 설계라서, 외부 beat나 downbeat 리스트로 교체하면 마디 그리드 위에서 경계와 라벨을 얻을 수 있다. 코드 수정이 필요하다.
- 라이선스가 명시되지 않은 것은 기본적으로 "All rights reserved"에 해당한다. 상업적으로 쓰려면 저자 허가가 필요할 것이다.

### Gaps
- Buisson et al.의 self-supervised multi-level 표현 논문("Learning multi-level representations for hierarchical MSA", ISMIR 2022 / TASLP)의 SALAMI 수치와 코드 라이선스는 이번 조사에서 확보하지 못했다.
- McCallum 2019(unsupervised embeddings)와 Salamon et al. 2021(deep embeddings + section fusion)의 원 수치도 확보하지 못했다. CBM 논문 Figure 12/13에 인용되어 있지만, PDF 텍스트 추출로는 막대 값과 모델명을 확실하게 대응시킬 수 없었다.

## 6. 마디 단위(barwise) 접근: Marmoret, Cohen, Bimbot (Barwise Compression 2022, CBM TISMIR 2023)

### Takeaway
madmom 다운비트로 곡을 마디 단위로 자르고 "Barwise TF matrix"를 만든 뒤 비지도 압축(PCA/NMF/AE) 또는 CBM(dynamic programming)으로 분할한다. 이 방식은 RWC-Pop에서 F3s 약 80%로 지도학습 CNN(79.3%)과 대등하다.

핵심 근거도 있다. 정답 경계를 다운비트에 정렬해도 RWC-Pop F0.5s 96.3%, SALAMI 약 81–82%가 유지된다. 즉 마디 그리드에 경계를 제한해도 손실이 작다.

### Cited Findings
- **Barwise Compression (Marmoret, Cohen, Bimbot, SMC 2022, arXiv 2202.04981)**
  - 파이프라인: madmom 다운비트 추정 → 마디당 고정 샘플의 Barwise TF matrix → PCA/NMF/AE 압축 → 자기유사도 → CBM 분할.
  - 경계 평가만 하고 라벨링은 다루지 않는다. 평가셋은 RWC-Pop(MIREX10 주석)뿐이다.
  - RWC-Pop 결과 (Table 1, P/R/F @0.5 s, @3 s):
    | 방법 | F0.5 | F3 |
    |---|---|---|
    | PCA | 63.1% | 79.2% |
    | NMF | 58.3% | 74.9% |
    | Autoencoder | 60.9% | 80.1% |
    | NTD(이전 작업) | 59.0% | 73.2% |
    | Foote(MSAF, 다운비트 정렬) | 34.5% | 55.0% |
    | Spectral clustering(MSAF, 다운비트 정렬) | 45.0% | 60.3% |
    | Supervised CNN(Grill & Schlüter, MIREX 2015) | 69.7% | 79.3% |
    | 정답을 다운비트에 정렬한 경우(상한) | 96.3% | 99.9% |

  - 출처: [arXiv 2202.04981](https://arxiv.org/abs/2202.04981)
- **CBM, Barwise MSA with the CBM Segmentation Algorithm (TISMIR 2023, arXiv 2311.18604)**
  - 정답 경계를 다운비트에 정렬했을 때의 F0.5s / F3s (Table 1):
    - SALAMI Annotation 1: 82.30% / 99.74%
    - SALAMI Annotation 2: 80.94% / 99.88%
    - RWC-Pop: 96.33% / 99.86%
    - 출처: [arXiv 2311.18604](https://arxiv.org/abs/2311.18604)
  - Foote 알고리즘을 시간 동기화 방식별로 비교 (Table 2–3, F0.5s / F3s). SALAMI-test는 Ullrich 2014 정의를 따른 485곡이다.
    | 동기화 | SALAMI-test | RWC-Pop |
    |---|---|---|
    | beat-sync | 29.21% / 54.02% | 27.29% / 57.95% |
    | 다운비트 재정렬 | 33.33% / 53.78% | 36.52% / 57.44% |
    | bar-sync | 35.97% / 55.57% | 32.46% / 51.97% |
    | Barwise TF matrix | 39.67% / 60.36% | 43.30% / 65.04% |

    — [arXiv 2311.18604](https://arxiv.org/abs/2311.18604)
  - CBM 최종 결과 (RBF SSM, 7-band kernel, modulo-8 penalty, λ=0.04, Table 8–9):
    - SALAMI-test: F0.5s 42.00%, F3s 60.61% (마디 단위 허용오차 F0bar 45.44%, F1bar 60.09%)
    - RWC-Pop: F0.5s 64.44%, F3s 80.64% (F0bar 65.17%, F1bar 81.02%)
    - 출처: [arXiv 2311.18604](https://arxiv.org/abs/2311.18604)
  - Barwise와 Beatwise CBM 비교 (penalty 없음, Table 10–11, F0.5s / F3s):
    - SALAMI: 41.04% / 60.51% vs 37.36% / 58.03%
    - RWC-Pop: 62.28% / 79.47% vs 44.57% / 69.51%
    - 저자 결론: 마디 정렬이 특히 RWC-Pop에서 유리하다 — [arXiv 2311.18604](https://arxiv.org/abs/2311.18604)
  - 저자 평가: CBM은 비지도 SOTA(Foote, McFee & Ellis, Serrà, McCallum)를 이기고, F3s에서는 지도 SOTA(Grill & Schlüter 2015)와 경쟁적이다.
  - 경계 다운비트 정렬로 생기는 손실은 상한 약 80% vs 현 SOTA 약 54%(SALAMI F0.5s) 수준이라 문제가 되지 않는다고 서술한다.
  - 코드: 오픈소스 toolbox와 노트북(gitlab.imt-atlantique.fr/a23marmo/autosimilarity_segmentation), PyPI `barmuscomp` — [arXiv 2311.18604](https://arxiv.org/abs/2311.18604), [PyPI barmuscomp](https://pypi.org/project/barmuscomp)
  - "modulo 8" penalty는 4/4 박자에서 8마디(=32 beat) 세그먼트를 선호하도록 설계됐다 — [arXiv 2311.18604](https://arxiv.org/abs/2311.18604)

### Inferences
- **마디 단위 제약의 손실은 작다**: SALAMI F0.5s 상한이 약 81%라서, 다운비트 정렬로 생기는 손실은 실제 모델 오차(현재 HR.5F 0.6–0.7)보다 작다. 팝 계열(RWC-Pop)에서는 사실상 손실이 없다(96%).
- **가요/CCM 적용 근거**: 한국 CCM은 4/4 박자에 8마디 프레이즈가 지배적인 팝 형식이다. 따라서 RWC-Pop 결과(마디 정렬 상한 96%, modulo-8 prior 유효)를 그대로 적용할 근거가 강하다.
- **추천 조합**: CBM 같은 마디 DP 위에 딥 모델의 boundary activation을 마디별 점수로 더한다. 이는 기존 연구에서 직접 검증된 조합은 아니고, 이 조사의 추론이다.
- **라이선스와 데이터 의존성**: barwise 방법은 비지도라서 학습 데이터 라이선스 문제가 없다. 다만 다운비트에 madmom 모델을 쓰면 CC BY-NC-SA 조항이 걸린다. 사용자는 Beat This!를 쓰므로 이 부분은 대체된다.

### Gaps
- `barmuscomp`와 autosimilarity_segmentation 코드의 라이선스 파일은 확인하지 못했다.
- CBM을 Harmonix나 Beatles에서 평가한 수치는 찾지 못했다.

## 7. SSL 임베딩(MERT / MuQ / MusicFM)과 MARBLE, 데이터셋별 커버리지, 라이선스 요약

### Takeaway
MARBLE(NeurIPS 2023)에는 구조 분석 과제가 없는 것으로 보인다. SSL 모델의 MSA 수치는 각 모델 논문과 후속 MSA 논문(TA 2025, SongFormer)에 흩어져 있다.

상업 이용 관점에서 공개 가중치가 있고 MIT로 표기된 모델은 All-In-One뿐이다. 그 외에는 비상업 조건(MuQ), 라이선스 불명(LinkSeg, MusicFM 가중치), 또는 비공개(SpecTNT, TA)다.

### Cited Findings
- **MARBLE(NeurIPS 2023)**: 12개 공개 데이터셋에 걸친 18개 과제로 구성된다 — [arXiv 2306.10548](https://arxiv.org/abs/2306.10548). 이 PDF 본문에서 "structure analysis" 과제를 텍스트 검색했지만 찾지 못했다(직접 확인).
- **SSL 모델의 MSA 수치** (Harmonix 기준, ACC / HR.5F, 인용값):
  - MERT(5 s): .574 / .626
  - MusicFM(30 s): .725 / .640, HR3F .729
  - MuQ_iter: ACC .772 (비공개 split)
  - 출처: [TA arXiv 2507.13572](https://arxiv.org/abs/2507.13572), [SongFormer](https://arxiv.org/pdf/2510.02797)
  - MusicFM README는 FM4 변형의 구조 분석 성능이 낮다(subpar)고 적고 있고, 구조 분석에는 긴 학습 입력이 중요하다고 언급한다 — [GitHub musicfm](https://github.com/minzwon/musicfm)
- **데이터셋 커버리지 (확인된 범위)**:
  - Harmonix: All-In-One, SpecTNT, Harmonic-CNN, TA, LinkSeg, SongFormer(수정 200곡)
  - RWC-Pop: SpecTNT, MuSFA, TA, LinkSeg, SongFormer, Barwise compression, CBM, GS3
  - SALAMI: Ullrich 2014, CBM, SpecTNT/MuSFA(SALAMI-pop 서브셋), GS(MIREX)
  - Beatles(Isophonics/TUT): SpecTNT, MuSFA, GS3
  - 출처: 위 각 섹션
  - 라벨 지표 보고 현황: PWF/Sf는 Wang 2022와 All-In-One만 보고했다. ACC는 Wang 계열, TA, SongFormer, LinkSeg가 보고했다.
- **라이선스 요약**:
  | 모델 | 코드 | 가중치 | 비고 |
  |---|---|---|---|
  | All-In-One | MIT | MIT (HF 태그) | 학습 데이터 Harmonix. madmom 모델 파일은 CC BY-NC-SA |
  | SongFormer | CC-BY-4.0 | 명시 없음 | 의존하는 MuQ 가중치가 CC-BY-NC 4.0 → 비상업 |
  | LinkSeg | LICENSE 없음 | repo 포함, 라이선스 없음 | |
  | MusicFM | MIT/Apache 혼재 | 명시 없음 | |
  | SpecTNT / TA / Harmonic-CNN | 공개 inference 코드 없음 | 없음 | |
  | CBM / barwise | 오픈소스 | 비지도라 가중치 없음 | 라이선스 미확인 |

  - 출처: [all-in-one](https://github.com/mir-aidj/all-in-one), [HF allinone](https://huggingface.co/taejunkim/allinone), [madmom LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE), [SongFormer](https://github.com/ASLP-lab/SongFormer), [MuQ HF](https://huggingface.co/OpenMuQ/MuQ-large-msd-iter), [LinkSeg](https://github.com/morgan76/LinkSeg), [musicfm](https://github.com/minzwon/musicfm), [SongFormer PDF](https://arxiv.org/pdf/2510.02797)

### Inferences
- **상업 가능 + T4 + 다운비트 결합을 모두 만족하는 현실적 조합**:
  1. All-In-One의 boundary·기능 activation(MIT)을 외부 Beat This! 다운비트에서 마디 단위로 샘플링한다.
  2. 그 위에 CBM 류 마디 DP(8마디 prior)로 분할한다.
  3. 라벨은 All-In-One의 세그먼트 평균 softmax로 정하거나 반복 구조(SSM)로 보정한다.
- **도메인 차이**: Harmonix 단일 학습 모델의 한국 CCM 적용 성능은 실측이 필요하다. 참고로 중국 가요 셋에서 All-In-One ACC 0.834, HR.5F 0.563이었다.

### Gaps
- MARBLE v2 또는 리더보드에 구조 과제가 추가되었는지는 확인하지 못했다. 검색 결과가 없었다.
- ISMIR 2025 / ICASSP 2026의 다른 MSA 논문(예: 다운비트 정렬을 명시적으로 결합한 딥 모델)은 이번 조사 범위 안에서 찾지 못했다. SongFormer와 TA가 확인된 최신 연구다.
- Harmonix Set 주석의 라이선스, 그리고 가중치 상업 이용에 대한 학습 데이터의 법적 영향은 확인하지 못했다.
