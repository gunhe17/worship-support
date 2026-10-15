# 송폼 경계 검출의 평가 지표·프로토콜·정답 주석(ground truth) 설계

## 1. mir_eval.segment / hierarchy 지표의 정확한 정의

### Takeaway
표준 지표는 boundary hit rate다. 경계를 1:1 최대 매칭한 뒤 P/R/F를 0.5 s와 3 s에서 계산한다. 보조 지표는 다음과 같다.
- median deviation
- 라벨이 필요한 프레임 기반 지표: pairwise F, NCE, V-measure
- 계층 지표: L-measure, T-measure

`evaluate()`는 기본값이 trim=False다. 곡의 시작·끝 경계가 점수를 부풀리지 않게 하려면 `detection(..., trim=True)`를 직접 호출해야 한다.

### Cited Findings
- `detection(ref_intervals, est_intervals, window=0.5, beta=1.0, trim=False)`: reference 경계가 estimate 경계의 window 안에 있으면 hit로 센다. 각 경계는 최대 한 번만 매칭되고, hit 수는 window 제약 아래 maximal matching(이분 매칭)의 크기로 계산한다. Precision = hits/|est|, Recall = hits/|ref|, F = β-가중 조화평균 — [mir_eval docs: segment](https://mir-eval.readthedocs.io/latest/api/segment.html); [mir_eval source segment.py](https://raw.githubusercontent.com/mir-evaluation/mir_eval/main/mir_eval/segment.py)
- `trim=True`이면 경계 배열의 첫·마지막 원소를 제거한 뒤 평가한다. 이는 곡 시작(0 s)과 곡 끝, 곧 interval의 양 끝이다. 경계 배열이 비면 detection은 (0,0,0), deviation은 (nan,nan)을 반환한다 — [segment.py](https://raw.githubusercontent.com/mir-evaluation/mir_eval/main/mir_eval/segment.py)
- `evaluate()`는 window를 0.5와 3.0으로 고정해 detection을 두 번 호출하고, trim은 전달하지 않는다(=False). 평가 전에 estimate 구간을 reference 길이에 맞춰 pad 또는 crop한다. 출력 키는 다음과 같다 — [segment.py](https://raw.githubusercontent.com/mir-evaluation/mir_eval/main/mir_eval/segment.py)
  - Precision/Recall/F-measure@0.5, @3.0
  - Ref-to-est deviation, Est-to-ref deviation
  - Pairwise P/R/F, Rand Index, ARI
  - MI/AMI/NMI
  - NCE Over/Under/F
  - V Precision/Recall/V-measure
- `deviation(..., trim=False)`: `dist = |ref_i − est_j|` 행렬에서 est→ref = median(ref 방향 min), ref→est = median(est 방향 min)이다. 반환 순서는 (reference_to_estimated, estimated_to_reference) — [segment.py](https://raw.githubusercontent.com/mir-evaluation/mir_eval/main/mir_eval/segment.py)
- F_β 일반식: F_β = (1+β²)·P·R / (β²·P + R). β<1이면 precision에 가중치가 더 실린다 — [Nieto et al. 2014, ISMIR, 식(4)](https://archives.ismir.net/ismir2014/paper/000124.pdf)
- 프레임 기반 지표(기본 `frame_size=0.1` s) — [mir_eval docs: segment](https://mir-eval.readthedocs.io/latest/api/segment.html)
  - `pairwise`: 같은 라벨을 가진 프레임 쌍 집합의 P/R/F
  - `ari`: chance 보정 Rand index
  - `nce(marginal=False)`: S_over = 1 − H(y_est|y_ref)/log|y_est|, S_under = 1 − H(y_ref|y_est)/log|y_ref| (|y|=1이면 0)
  - `vmeasure` = `nce(marginal=True)`: 분모를 log|y| 대신 주변 엔트로피 H(y_est), H(y_ref)로 정규화
- TISMIR 리뷰의 지표 해설 — [Nieto et al. 2020, TISMIR "Audio-Based Music Structure Analysis"](https://transactions.ismir.net/articles/10.5334/tismir.54)
  - 3 s 기준은 Levy & Sandler, 0.5 s 기준은 Turnbull et al.에서 왔다.
  - median deviation은 outlier를 놓치기 쉬워 hit rate가 선호된다.
  - pairwise는 경계 위치에 과민하다.
  - NCE는 log|Y|로 정규화하므로 라벨 분포가 비균등하면 점수가 부풀려질 수 있다. MIREX 구현에도 문제가 있다.
  - V-measure는 주변 엔트로피로 정규화해 트랙 간 비교에 더 공정하다.
- L-measure — [McFee et al. 2017, Frontiers in Psychology](https://pmc.ncbi.nlm.nih.gov/articles/PMC5541043/); [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)
  - meet M(u,v|H): 두 시점 u, v가 같은 라벨을 공유하는 가장 깊은 레벨
  - 삼중항 집합 A(H) = {(t,u,v): M(t,u|H) > M(t,v|H)}
  - L-Precision = |A(H_R)∩A(H_E)|/|A(H_E)|, L-Recall = |A(H_R)∩A(H_E)|/|A(H_R)|, L-measure = 둘의 조화평균
  - 정렬 오차에는 상대적으로 덜 민감하고, 서로 양립할 수 없는 주석에는 더 민감하다.
- mir_eval.hierarchy 시그니처 — [mir_eval source hierarchy.py](https://raw.githubusercontent.com/mir-evaluation/mir_eval/main/mir_eval/hierarchy.py)
  - `tmeasure(ref_hier, est_hier, transitive=False, window=15.0, frame_size=0.1, beta=1.0)`: query 프레임 q 기준 ±window초 안의 프레임만 쓴다. transitive=False("reduced")는 정확히 한 레벨 차이 나는 쌍만, True("full")는 임의 레벨 차이를 허용한다.
  - `lmeasure(ref_int_hier, ref_lab_hier, est_int_hier, est_lab_hier, frame_size=0.1, beta=1.0)`
  - evaluate 키: T-Precision/Recall/Measure(reduced·full), L-Precision/Recall/Measure

### Inferences
- 우리 과제(경계만 비교, 방법 3–5개)의 지표 구성:
  - 주 지표: trim=True 상태의 F@(마디 허용치), P와 R을 분리해 보고
  - 보조 지표: 마디 단위로 환산한 median deviation
  - 라벨까지 출력하는 방법이 있으면 pairwise F 또는 V-measure를 추가한다.
  - 악보 섹션 태그가 단일 레벨이면 계층 지표는 필요 없다.
- trim을 끄면 곡마다 경계 2개(0 s, 곡 끝)가 공짜 hit가 된다. 경계가 8–10개인 짧은 찬양곡에서는 F가 크게 부풀려진다(경계 10개 중 2개면 20%).

### Gaps
- mir_eval 원 논문(Raffel et al. 2014) 본문은 직접 확인하지 못했다. 위 정의는 현행 문서와 소스 코드를 따른다.

## 2. 박/마디 기반 허용치(tolerance)

### Takeaway
0.5 s와 3 s는 각각 "약 1박", "80 BPM 4/4에서 약 1마디"에서 나온 관습값이라 템포에 따라 엄격도가 달라진다. Marmoret et al.(TISMIR 2023)은 레퍼런스를 가장 가까운 다운비트에 정렬한 뒤 0-bar/1-bar 허용치(F0bar, F1bar)를 정의했고, "1마디 ≈ 3 s" 가설을 실험으로 뒷받침했다.

### Cited Findings
- 3 s 허용치는 "80 bpm 4박자 곡에서 약 1마디"라는 근거로, 0.5 s는 박 수준의 크기라는 근거로 정당화된다(Ong & Herrera 2005, Turnbull et al. 2007 인용) — [Marmoret, Cohen, Bimbot 2023, TISMIR 6(1) / arXiv 2311.18604 §4.1.1](https://arxiv.org/pdf/2311.18604)
- Barwise-aligned 지표: 각 레퍼런스 경계를 가장 가까운 (추정) 다운비트에 정렬한다. 그다음 두 종류의 P/R/F를 계산한다 — [arXiv 2311.18604 §4.1.2](https://arxiv.org/pdf/2311.18604)
  - P/R/F_0bar: 같은 다운비트에 정확히 일치해야 hit
  - P/R/F_1bar: 정확히 1마디 차이까지 허용
- 레퍼런스를 다운비트에 스냅했을 때의 결과 — [arXiv 2311.18604 §2.3.1](https://arxiv.org/pdf/2311.18604)
  - RWC Pop: 원본 대비 손실이 거의 없다. 주석이 다운비트에 정확히 놓여 있다는 뜻이다.
  - SALAMI: 짧은 허용치에서 손실이 생긴다. 원인은 마디 추정이 부정확하거나 경계가 다운비트에 없기 때문이다.
  - 그래도 스냅된 주석 vs 원본의 F0.5s는 ≈ 80%로, 당시 SOTA(≈54%, Grill & Schlüter 2015)보다 훨씬 높다.
- 마디 허용치와 초 허용치를 비교하면 RWC Pop에서는 거의 같고, SALAMI에서는 F0bar와 F0.5s만 약간 다르다. 이는 "3 s ≈ 1 bar" 가설을 지지한다 — [arXiv 2311.18604 §4.2.6](https://arxiv.org/pdf/2311.18604)
- Harmonix Set: 세그먼트의 81.1%가 다운비트에서 시작하고, 10%는 4박째(1박 count-in·픽업)에서 시작한다 — [Nieto et al. 2019, Harmonix Set, ISMIR](https://archives.ismir.net/ismir2019/paper/000068.pdf)
- Harmonix 실험: 0.5 s window에서는 사람이 단 beat를 쓸 때가 추정 beat보다 분명히 좋고, 3 s window에서는 비슷하다. 허용치가 짧을수록 beat 정확도에 민감하다는 뜻이다 — [Harmonix Set paper](https://archives.ismir.net/ismir2019/paper/000068.pdf)
- SALAMI는 주석 과정에서 "픽업이 있어도 경계를 다운비트에 둔다"는 휴리스틱을 도입했다 — [Smith et al. 2011, ISMIR](https://archives.ismir.net/ismir2011/paper/000099.pdf)
- 심볼릭 구조 분석에서는 하위 레벨에 1-beat, 상위 레벨에 1-bar 허용치를 쓴 사례가 있다 — [arXiv 2303.13881](https://arxiv.org/pdf/2303.13881) (검색 요약 기준, 본문 미확인)

### Inferences
- 템포 의존성 예: 3 s는 60 BPM 4/4에서 0.75마디, 120 BPM에서 1.5마디, 140 BPM에서 1.75마디다. 찬양곡에는 느린 발라드(60–75 BPM)부터 빠른 곡(130 BPM 이상)까지 섞여 있다. 초 단위 허용치로는 곡마다 엄격도가 달라지므로 마디 단위가 더 공정하다.
- 구현은 간단하다. 두 가지 방법이 있다.
  - 경계 시각을 다운비트 인덱스(정수)로 바꾼 뒤 `mir_eval.util.match_events(ref_idx, est_idx, window=k)`로 k=0, 1마디 매칭을 한다.
  - 시간축을 "마디 번호"로 바꾸고 `detection(window=0.5)`(=0-bar), `window=1.0`(=1-bar)을 그대로 쓴다.
- 주 지표로 F@0bar(정확)와 F@1bar(관대)를 보고하고, 문헌 비교용으로 F@0.5s/F@3s를 함께 적을 것을 권장한다.
- 1박 픽업(Harmonix 10%)은 찬양곡에도 흔하다(가사가 못갖춘마디로 시작). 0-bar 평가가 의미 있으려면 주석 가이드에 "섹션 경계 = 다운비트" 규칙을 명시해야 한다.

### Gaps
- 마디 단위 허용치를 표준으로 정한 커뮤니티 합의 문서는 찾지 못했다. 연구 관례 수준이다.

## 3. 주석 모호성과 인간 일치도 상한

### Takeaway
SALAMI 이중 주석 974쌍에서 평균 경계 F는 대규모(대문자) 레벨끼리 @0.5 s 0.69, @3 s 0.77이었다. 레벨 조합을 최적으로 고르면 0.80/0.89다. 인간 상한은 흔히 "약 90%"로 인용된다. 청취자는 recall보다 precision을 더 중시한다(Nieto 2014는 F_0.58을 제안).

### Cited Findings
- SALAMI 974쌍 이중 주석의 평균 일치도는 아래 표와 같다 — [Smith et al. 2011, Table 3](https://archives.ismir.net/ismir2011/paper/000099.pdf) (주의: pdftotext로 추출한 표를 열 순서대로 재구성함)

  | 비교 | PW f | Rand | Bound F@0.5 s | Bound F@3 s |
  |---|---|---|---|---|
  | Large-large | 0.76 | 0.79 | 0.69 | 0.77 |
  | Small-small | 0.69 | 0.81 | 0.73 | 0.82 |
  | Small-large 교차 | 0.60 | 0.70 | 0.38 | 0.44 |
  | Best case(4개 조합 중 최대) | 0.81 | 0.87 | 0.80 | 0.89 |

- 데이터셋 규모 — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54); [McFee et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5541043/)
  - SALAMI: 공개분 1,359 트랙 중 884곡이 2명 이상 주석, 전문가 10명, 3단계 계층
  - SPAM: 50곡, 곡당 최소 5명 주석
- 경계 검출의 인간 성능은 F@0.5 s, F@3 s 모두 "약 90%로 여겨진다"(Serrà et al. 2014 인용). 일부 장르(클래식, 비서구)에서는 알고리즘이 상한에 근접하는데, 주석 일관성이 낮아서일 수 있다 — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)
- 참고용 MIREX 결과(%, ± = 트랙 간 표준편차) — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)
  - SALAMI subset: F@0.5 s 54.09±18.50, F@3 s 68.94±17.51
  - MIREX 2009: F@0.5 s 56.42±17.04, F@3 s 70.35±14.87
- 계층 평가에서 인간 간 L-measure를 상한으로 가정하면 인간–알고리즘 사이에 "상당히 큰 격차"가 있다. 트랙별 L-measure는 0.06~0.94로 분산이 극단적이다 — [McFee et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5541043/)
- Nieto et al. 2014 — [Nieto et al. 2014, ISMIR](https://archives.ismir.net/ismir2014/paper/000124.pdf)
  - 실험 2: 참가자 48명(음악 훈련 평균 3.1±1.6년)이 높은 precision의 세그멘테이션을 선호했다.
  - α를 0→1까지 0.05 단위로 바꾸며 logistic regression을 돌렸다. 유의수준 0.01에서 선호를 예측하는 첫 α가 0.58이다.
  - F_0.58로 다시 계산하면 실험 2의 HP/HR은 71.8%/58.9%다(원래 F1은 둘 다 65.0%).
  - 저자도 α 값이 소규모 데이터에 과적합되었을 수 있다고 밝혔다.
- 경계 지각 연구(Bruderer, McKinney, Kohlrausch) — [ISMIR 2006 / Musicae Scientiae 2009, 2010](https://archives.ismir.net/ismir2006/paper/000142.pdf); [TU/e 레코드](https://research.tue.nl/en/publications/the-perception-of-structural-boundaries-in-polyphonic-representat/) (초록 기준)
  - 청취자마다 경계의 개수와 위치가 크게 다르지만, 일부 경계는 거의 모든 참가자가 표시했다.
  - 경계 표시 빈도는 평균 salience 평점과 상관이 높다.
  - 주요 단서는 화성 진행, 리듬, 음색, 템포 변화다.
- Wang et al. 2017: 경계가 strong/weak, gradual/sudden인지와 청취자의 음악 숙련도에 따라 차이가 난다. 복수 주석의 평균·최대, 합의 gold standard 같은 대응책이 제안됐지만 최소 주석자 수에 대한 합의는 없다 — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)

### Inferences
- 악보 섹션 태그(Verse/Chorus 등)를 정답으로 쓰면 "기능적 대규모 레벨"에 해당한다. 인간 간 일치도의 현실적 참고치는 SALAMI Large-large 수준(F@3 s ≈ 0.77)이다. 악보 기반이라 오디오 청취 주석보다 모호성은 낮을 것으로 예상한다. 다만 실제 연주는 편곡 반복, 간주, 엔딩 반복 등으로 악보와 다를 수 있다.
- 방법 3–5개를 비교할 때는 F_1(β=1)을 주 지표로 하고 P와 R을 따로 보고하는 편이 F_0.58 단일값보다 안전하다. precision 편향을 따로 해석할 수 있고, α=0.58은 저자도 과적합 가능성을 인정한 값이다.
- 10곡 중 2–3곡을 다른 사람이 독립적으로 주석하면 inter-annotator F@0bar/1bar를 계산해 "이 데이터의 상한"을 직접 얻을 수 있다.

### Gaps
- Harmonix Set은 트랙당 주석이 하나뿐이라 inter-annotator 수치가 없다.
- Serrà et al. 2014의 "약 90%"가 어떤 방식으로 측정된 수치인지는 직접 확인하지 못했다.

## 4. 주석 가이드라인 (SALAMI, Harmonix, RWC, Isophonics)

### Takeaway
SALAMI는 세 가지를 독립 트랙으로 기술한다. (1) 음악적 유사성 2레벨(대문자 A,B / 소문자 a,b), (2) 제한된 어휘의 기능 라벨, (3) 리드 악기. Harmonix는 DAW에서 MIDI 템포 트랙 위에 beat/downbeat/섹션을 코딩한 단일 주석이다.

### Cited Findings
- SALAMI 형식 — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf)
  - 대규모 레이어는 대문자, 소규모 레이어는 소문자를 쓴다.
  - 모든 구간에 문자 라벨이 필수다.
  - 대규모 레이어는 곡당 고유 대문자를 5개 이하로 쓰는 것을 선호한다(추상화 수준을 맞추기 위한 규칙).
  - 특수 라벨로 "silence"와 비음악(박수 등)이 있다.
- SALAMI 기능 라벨 어휘(Table 2). 기능 라벨이 모든 구간에 필수는 아니다 — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf); 데이터·가이드 페이지 [SALAMI Annotation Data](https://ddmal.music.mcgill.ca/research/salami/annotation)

  | 분류 | 라벨 |
  |---|---|
  | 기본 | intro, verse, chorus, bridge |
  | 기악 | instrumental, solo |
  | 전이 | transition, pre-chorus, pre-verse, interlude |
  | 장르별 | head, main theme, (secondary) theme |
  | 형식별 | exposition, development, recapitulation |
  | 종결 | outro, coda, fadeout |
  | 특수 | silence, end |

- 기능·유사성·악기를 한 라벨에 섞으면 문제가 생겨 독립 트랙으로 분리했다(예: outro가 verse와 같은 음악 재료를 쓸 수 있음) — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf)
- 처음에는 Peeters & Deruty의 "V1/V2" 표기를 썼다. 두 시간척도를 명시적으로 기술하는 쪽이 더 단순하고 빠르다는 주석자 의견에 따라 바꿨다 — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf)
- Harmonix — [Nieto et al. 2019](https://archives.ismir.net/ismir2019/paper/000068.pdf); [GitHub urinieto/harmonixset](https://github.com/urinieto/harmonixset)
  - 912곡을 음악 제작 현업의 전문 음악가가 주석했다. 후반에는 소수의 전문화된 인원이 맡았다.
  - 과정: Reaper/Logic 등 DAW에서 오디오에 맞는 MIDI 템포 트랙을 먼저 만든다 → beat·downbeat·섹션을 note/text event로 코딩한다 → MIDI로 내보내 텍스트로 자동 변환한다 → 원 주석자가 1회 검증한다.
  - 곡당 세그먼트는 약 10–11개, 고유 라벨은 6–7개다. "chorus"와 "verse"가 대부분이며, "inst"/"instrumental" 같은 중복 라벨이 있다.
  - JAMS(0.3.3)로 배포된다.
- RWC와 Isophonics — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54); [Harmonix paper §2](https://archives.ismir.net/ismir2019/paper/000068.pdf)
  - RWC(AIST): 315곡 중 300곡 주석, 단일 주석자
  - Isophonics: 300곡 단일 주석(비틀즈 위주 팝록)
  - TUT Beatles: 174곡, Isophonics 비틀즈 주석의 정제판
  - 이들의 라벨은 "solo", "verse", "chorus" 같은 기능 라벨이다.

### Inferences
- 찬양곡용 최소 가이드 제안
  - 라벨 어휘 고정: intro / verse / pre-chorus / chorus / bridge / interlude(간주) / outro / ending(tag·반복 엔딩)
  - (a) 경계는 섹션의 첫 다운비트에 둔다. 가사 픽업은 무시한다(SALAMI 휴리스틱과 같음).
  - (b) 같은 섹션이 반복될 때(Chorus×2) 반복마다 경계를 둘지 명시한다. 악보 반복기호와 실제 연주를 대응시키는 규칙도 정한다.
  - (c) 모호한 경계는 strong/weak flag를 따로 단다.
- 악보 섹션 태그를 오디오 시각으로 옮길 때 다운비트 인덱스로 저장하면 템포 변화나 루바토가 있어도 안정적이다.

### Gaps
- SALAMI Annotator's Guide 원문(PDF)은 직접 열람하지 못했다. 논문에 따르면 SALAMI 데이터 페이지에서 링크를 제공한다.
- Harmonix의 세부 라벨 정의 문서는 공개 여부를 확인하지 못했다.

## 5. 필요한 곡 수, 통계적 검정

### Takeaway
MIR 커뮤니티는 Friedman + Tukey 같은 비모수 검정을 관례로 쓰고, 유의성보다 효과 크기를 보고하라고 권한다. 구조 분할 평가셋의 최소 크기에 대한 가이드는 찾지 못했다. 곡당 F의 표준편차가 0.15–0.18 수준이라 10곡으로는 작은 차이를 구분할 수 없다(아래 추론 참고).

### Cited Findings
- Urbano & Flexer의 ISMIR 2018 튜토리얼: MIR은 Friedman 검정과 Tukey 다중비교 같은 비모수 방법을 써 왔다. 가설검정은 제대로 이해하지 못하면 매우 오도적일 수 있고, 검정이 맞더라도 validity 문제로 결과가 무너질 수 있다 — [ISMIR 2018 tutorial](https://ismir2018.ircam.fr/pages/events-tutorial-17.html)
- MIREX AMS 연구: 통계적 유의성 지표(작은 p-value)는 결국 부차적이고 효과 크기를 보고해야 한다 — [Urbano et al. 2012 "How Significant is Statistically Significant?"](https://research.jku.at/en/publications/how-significant-is-statistically-significant-the-case-of-audio-mu/). 유의한 차이라도 실제로는 무의미할 만큼 작을 수 있다 — [Validity in MIR Experiments, arXiv 2301.01578](https://arxiv.org/pdf/2301.01578)
- ISMIR 2011 AMS 신뢰도 연구: 통계 절차를 바꾸면 MIREX 쿼리 수의 절반으로도 같은 결론을 낼 수 있다 — [ISMIR 2011 paper 000023](https://archives.ismir.net/ismir2011/paper/000023.pdf)
- McFee et al.은 인간–알고리즘 일치도 분포와 인간 간 일치도 분포를 two-sample Kolmogorov–Smirnov 검정으로 비교했다. Flexer & Grill의 제한된 inter-rater agreement 연구는 성능 상한의 근거로 인용된다 — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)
- 트랙 간 표준편차: F@0.5 s ±14–19%p, F@3 s ±9–18%p (MIREX/SALAMI) — [TISMIR 리뷰](https://transactions.ismir.net/articles/10.5334/tismir.54)

### Inferences
- (계산) 곡당 F의 SD ≈ 0.17이면 n=10에서 평균의 95% CI 반폭은 t₀.₉₇₅,₉(2.26)·0.17/√10 ≈ ±0.12다. 방법 하나의 평균 F만 해도 ±12%p 불확실하다. 방법 간 비교는 곡별 paired 차이로 해야 SD가 줄어든다.
- (계산) n=10 Wilcoxon signed-rank의 최소 양측 p는 2/2¹⁰ ≈ 0.002다(10곡 모두 같은 방향일 때). 대략 p<0.05가 되려면 10곡 중 8곡 이상 이겨야 한다(정확한 임계는 순위합에 따라 다름). 방법 3–5개를 다중비교하면 Friedman + post-hoc(Holm/Nemenyi)이 필요하다. 10곡으로는 효과가 클 때만 검출할 수 있다.
- 권장 프로토콜
  1. 곡 단위 paired bootstrap(곡을 복원추출, 10,000회)으로 ΔF의 95% CI를 보고한다.
  2. Wilcoxon/Friedman p값은 보조로만 쓴다.
  3. 곡별 승패 표(win/tie/loss)를 공개한다.
  4. 10곡을 하이퍼파라미터 튜닝에 쓰지 않는다. 튜닝용 dev 2–3곡과 test를 분리하거나 leave-one-out을 쓴다.
- 라벨 없는 500곡으로는 방법 간 출력 일치도(서로를 reference로 둔 F)나 경계 개수 분포 같은 비지도 진단만 가능하다. 정확도를 대신할 수는 없다. 정답셋을 20–30곡으로 늘리면 CI 반폭이 약 ±0.07–0.06으로 줄어든다(√n 스케일링에 따른 추론).

### Gaps
- 구조 분할 과제에 특화된 최소 테스트셋 크기나 검정력 연구는 찾지 못했다.
- Flexer의 구조 분할 inter-rater 논문 원문과 Urbano SIGIR 2013/2019의 검정 비교 결과는 직접 확인하지 못했다.

## 6. 실무 주석 도구와 소요 시간

### Takeaway
SALAMI는 Sonic Visualiser로 주석했고 곡당 최빈값 15–20분(평균 17–21분)이 걸렸다. Harmonix는 DAW+MIDI 방식을 썼다. 저장·배포 포맷은 JAMS가 사실상 표준이다.

### Cited Findings
- SALAMI 주석자는 Sonic Visualiser를 썼다(키보드로 경계 삽입·라벨링이 빠름). 권장 워크플로는 다음과 같고, 강제는 아니었다 — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf)
  1. 들으면서 경계를 표시한다.
  2. 다시 들으며 경계를 조정하고 소문자 라벨을 단다.
  3. 대문자·기능 라벨을 단다.
  4. 리드 악기 라벨을 단다.
- 자가보고 소요시간: 최빈값은 첫 100일 20분에서 이후 15분으로 줄었다(평균 곡 길이 4:21을 약 3회 듣는 분량). 평균은 21분에서 17분으로 줄었다. 곡 길이와 약하게 상관한다 — [Smith et al. 2011](https://archives.ismir.net/ismir2011/paper/000099.pdf)
- Harmonix: DAW(Reaper/Logic)에서 MIDI 템포 트랙 → beat/downbeat/섹션 text event → 자동 변환 — [Nieto et al. 2019](https://archives.ismir.net/ismir2019/paper/000068.pdf)
- JAMS: JSON 기반 음악 주석 포맷이다(simplicity, structure, sustainability). beat/chord/segment 등의 네임스페이스 스키마와 Python 라이브러리를 제공한다 — [Humphrey et al. 2014, ISMIR](https://archives.ismir.net/ismir2014/paper/000355.pdf); [jams docs](https://jams.readthedocs.io/); [GitHub marl/jams](https://www.github.com/marl/jams)

### Inferences
- 우리 상황에서는 beat/downbeat를 이미 믿을 수 있다. 오디오를 들으며 주석하기보다 "악보 섹션 순서 + 각 섹션의 시작 마디 번호"만 입력하는 방식이 가장 빠르다(곡당 몇 분으로 예상하지만 검증하지 않음). 검증은 Sonic Visualiser나 Audacity 라벨 트랙에 다운비트와 경계를 띄워 한 번 들어 보면 된다.
- 저장 포맷은 간단한 CSV/JSON(`bar_index, label`)으로 충분하다. mir_eval 입력(intervals, labels)으로 바꾸는 함수 하나만 있으면 된다. JAMS는 외부 공유가 필요할 때만 쓴다.

### Gaps
- Audacity 라벨을 구조 주석에 쓴 공식 데이터셋 사례와 악보 기반 주석의 소요 시간 수치는 찾지 못했다.
