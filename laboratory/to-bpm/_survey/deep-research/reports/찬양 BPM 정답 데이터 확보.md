# 찬양 정답 데이터, 사서 만들고 고쳐서 만든다

찬양·CCM 비트, 다운비트, 템포 정답이 붙은 공개 데이터셋은 국내외 모두 **찾지 못했다**. 그러니 14개 방법을 4–7분 찬양곡으로 공정하게 비교하려면 정답을 직접 만들어야 하고, 공개 데이터셋은 보조 역할에 머문다. 공개 세트 중 전곡이면서 팝·록 밴드 사운드인 것은 Harmonix(912곡), Beatles(180), RWC Popular(100), Rock Corpus(200), MUSDB18(150, BeatNet+ 주석)뿐이다. 이 가운데 음원을 합법적으로 쉽게 구할 수 있는 것은 사실상 MUSDB18 하나다. 게다가 대부분이 Beat This!나 madmom의 학습 데이터라서, 모든 모델에 깨끗한 공개 세트는 여전히 GTZAN밖에 없다. 반면 찬양 쪽에는 특유의 지름길이 있다. 워십 녹음은 대개 클릭에 맞춰 연주되고, MultiTracks에서 산 멀티트랙에는 마스터와 정렬된 Click 스템이 들어 있다. 이 스템에서 온셋만 찍어도 템포 전환까지 포함한 거의 정확한 비트 정답이 나온다. 권장 구조는 세 층이다. 클릭 스템으로 만든 정밀 정답 30–50곡, 모델 출력을 사람이 고친 정답 약 100곡, 그리고 500곡 전체에 붙이는 "전역 BPM·박자·템포 변화 여부" 라벨이다. 평가는 mir_eval 기본값을 그대로 쓰면 안 된다. 5초 트림, ×3 변형 부재, Acc1/Acc2 미구현 같은 함정을 직접 보정해야 한다.

## 공개 데이터셋: 전곡이면서 음원까지 있는 세트는 MUSDB18 정도뿐

고전 데이터셋은 대부분 20–40초 클립이다. Ballroom 698곡(중복 13곡을 빼면 685곡), SMC 217곡(40초), ISMIR04 465곡(약 20초), GiantSteps 664곡(약 2분)이 그렇다. 그래서 GTZAN과 같은 한계를 공유한다 ([Böck 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf), [MTG ISMIR04](https://mtg.upf.edu/ismir2004/contest/tempoContest/node6.html)). 전곡에 비트와 다운비트가 함께 붙은 세트는 Beatles 180곡(8시간 9분), RWC Popular 100곡(6시간 47분), Rock Corpus 200곡(12시간 53분), Robbie Williams 65곡, Harmonix 912곡(56시간 이상)이다 ([Böck 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf), [Hung et al. 2022](https://arxiv.org/pdf/2205.14701)). 문제는 음원이다. **Beatles는 CD를 사야 하고, RWC는 AIST에서 구매해야 하며, Rock Corpus는 원본 녹음을 직접 갖춰야 한다** ([mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html), [rockcorpus](https://rockcorpus.midside.com/)). Harmonix는 YouTube 링크와 mel 스펙트로그램만 배포한다. Hung et al.은 "YouTube 음원에 주석을 정렬하면 오류가 많다"고 보고하고 직접 재정렬했다 ([harmonixset](https://github.com/urinieto/harmonixset), [Hung et al. 2022](https://arxiv.org/pdf/2205.14701)). 14개 방법은 모두 오디오를 입력으로 받는다. 따라서 Beat This!가 Zenodo에 올린 사전 계산 스펙트로그램으로는 librosa나 Essentia를 돌릴 수 없다 ([Zenodo 13922116](https://zenodo.org/records/13922116)).

2022–2026년에 나온 자료 중에서는 **BeatNet+가 MUSDB18 150곡에 새로 붙인 비트·다운비트 주석**이 우리 목적에 가장 가깝다. 실제 팝·록 전곡이고, 오디오(스템 포함)를 구할 수 있다 ([BeatNet+ TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.198), [주석 GitHub](https://github.com/mjhydri/BeatNet-Plus/tree/main/annotations)). 드럼 스템이 있으니 반/두 배 오류가 났을 때 원인을 진단하기도 좋다. 다만 주석 라이선스는 명시되지 않았다. Osu2MIR(708개 오디오)는 리듬게임 차트에서 비트와 다운비트를 뽑았고, 타이밍 포인트가 여러 개인 곡을 subset 2·3으로 따로 표시한다. 그래서 **명시적으로 템포 변화 곡을 골라낼 수 있는 유일한 신규 자료**다. 하지만 장르가 애니메이션·보컬로이드 쪽으로 치우쳐 있고, 음원은 사용자가 osu!에서 직접 받아야 한다 ([arXiv 2509.12667](https://arxiv.org/abs/2509.12667), [GitHub](https://github.com/ziyunliu4444/osu2mir)). Raveform은 전문가 주석 1,423곡을 제공하지만 EDM이고 템포가 불안정한 곡은 아예 제외했다. 템포 드리프트 평가에는 쓸 수 없다 ([Raveform](https://transactions.ismir.net/articles/288)). 템포 곡선을 사람이 직접 라벨링한 POP909도 있지만 MIDI 전용이다 ([ISMIR 2020](https://archives.ismir.net/ismir2020/paper/000089.pdf)).

| 데이터셋 | 규모 | 전곡 | 주석 | 장르 | 음원 입수 (2026) | 비고 |
|---|---|---|---|---|---|---|
| GTZAN (+GTZAN-Rhythm) | 1,000 (993 사용) | 30초 | B, DB, T | 10장르 | 무료 | 모든 문서화된 모델에 깨끗 |
| MUSDB18 + BeatNet+ 주석 | 150 | 예 | B, DB | 팝·록 | 구할 수 있음 | 주석 라이선스 미기재 |
| Harmonix | 912 | 예 | B, DB, 구간 | 서양 팝·록 | YouTube만, 정렬 오류 | Beat This! 학습 데이터 |
| RWC Popular | 100 | 예 | B, DB, T | J-pop | AIST 구매 | Beat This!·madmom 학습 데이터 |
| Beatles | 180 | 예 | B, DB | 팝·록(스튜디오) | CD 구매 | Beat This!·madmom·BeatNet 학습 데이터 |
| Rock Corpus | 200 | 예 | B, DB | 록 | 원본 직접 확보 | madmom 다운비트·BeatNet 학습 데이터 |
| Ballroom | 685 | 30초 | B, DB, T | 댄스 | 무료(CC0) | 거의 모든 모델이 학습 |
| SMC | 217 | 40초 | B | 표현적 타이밍 | 요청 | 어려운 곡만 모은 스트레스 테스트 |
| GiantSteps Tempo v2 | 664 | 약 2분 | T(분포) | EDM | Beatport 프리뷰 스크립트 | 템포 전용 |
| ACM Mirum / ISMIR04 | 1,410 / 465 | 클립 | T | 팝·록 / 혼합 | 불명확 / 오래됨 | 템포 전용, 비교적 깨끗 |
| Osu2MIR | 708 | 불명확 | B, DB, 타이밍 포인트 | 애니·게임 | osu!에서 사용자 다운로드 | 템포 변화 subset 있음 |
| 찬양·CCM·가스펠 | 없음 | — | — | — | — | 국내외 모두 발견 못 함 |

라이브 녹음에 비트를 붙인 데이터셋도 사실상 없다. 가장 가까운 것이 마디 단위 주석만 있는 라이브 재즈 JazzSAMBA다 ([arXiv 2609.34931](https://arxiv.org/abs/2609.34931)). 주석 품질은 세트마다 버전 차이가 있다. GTZAN, RWC Pop, Harmonix는 CPJKU `beat_this_annotations` v1.1의 수정본을 기준으로 삼고, 결과를 보고할 때 주석 버전을 함께 적어야 한다 ([beat_this_annotations](https://github.com/CPJKU/beat_this_annotations)).

## 학습 데이터 누수: 모든 모델에 공정한 공개 세트는 GTZAN 하나다

Beat This! `final*`와 `small*`는 **GTZAN을 뺀 16개 데이터셋 4,556곡 전부**로 학습했다. 학습 세트에는 Ballroom, Beatles, Harmonix, RWC 전체, SMC, Hainsworth, HJDB, GuitarSet, Candombe 등이 들어 있다. README도 이 체크포인트의 공정한 평가는 "GTZAN이나 우리가 다루지 않은 데이터셋"에서만 가능하다고 직접 경고한다 ([beat_this README](https://github.com/CPJKU/beat_this), [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)). madmom 다운비트 RNN(2016)은 Ballroom, Beatles, Hainsworth, HJDB, RWC Pop, Robbie Williams, Rock Corpus 등으로 8-fold 학습했고 GTZAN, SMC, Klapuri만 테스트로 남겼다 ([Böck 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf)). madmom 비트·템포(2015)는 Ballroom, Hainsworth, SMC로 학습했다 ([Böck 2015](https://www.ismir2015.uma.es/articles/196_Paper.pdf)). 배포된 madmom 모델은 8개 fold 네트워크의 앙상블이다. 그래서 학습 세트의 **모든 곡을 앙상블 전체로는 이미 본 셈**이고, 배포 모델만으로는 교차검증식 공정 평가를 할 수 없다. BeatNet의 "Model 1 (GTZAN)"은 논문의 실험 설계로 미루어 GTZAN을 테스트로 남긴 모델이다(Ballroom, Beatles, Carnatic, Rock Corpus로 학습). 다만 README가 이를 명시하지는 않는다 ([BeatNet paper](https://arxiv.org/abs/2108.03576), [BeatNet GitHub](https://github.com/mjhydri/BeatNet)). TempoCNN은 LMD Tempo, MTG Tempo, Extended Ballroom에서 원본 Ballroom을 뺀 세트로 학습했다 ([Schreiber & Müller 2018](http://ismir2018.ircam.fr/doc/pdfs/141_Paper.pdf)). **DeepRhythm은 학습 데이터를 공개하지 않았다.** 2026년 벤치마크에서 GiantSteps Acc2가 98.5%인 반면 Acc1은 71%다. EDM으로 학습했다는 의심이 들지만 확인되지 않았다 ([benchmarks.md](https://github.com/bleugreen/deeprhythm/blob/main/docs/benchmarks.md)).

| 데이터셋 | Beat This! final/small | madmom 비트·템포 | madmom 다운비트 | BeatNet M1 | TempoCNN | DeepRhythm |
|---|---|---|---|---|---|---|
| GTZAN | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 불명 |
| MUSDB18 | 목록에 없음 | 목록에 없음 | 목록에 없음 | 목록에 없음 | 목록에 없음 | 불명 |
| Harmonix | **학습** | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 불명 |
| Rock Corpus | 목록에 없음 | 깨끗 | **학습** | **학습** | 깨끗 | 불명 |
| Ballroom | **학습** | **학습** | **학습** | **학습** | 원본 제외 | 불명 |
| Beatles / RWC Pop | **학습** | 깨끗 | **학습** | Beatles **학습** | 깨끗 | 불명 |
| SMC | **학습** | **학습** | 깨끗 | 깨끗 | 깨끗 | 불명 |
| GiantSteps | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 겹칠 가능성 | 의심 |
| 찬양 자체 세트 | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 깨끗 | 깨끗(추정) |

표에서 읽을 수 있는 점은 두 가지다. 첫째, 공개 전곡 세트는 **모델 쌍마다 유불리가 엇갈린다.** Harmonix는 Beat This!에 유리하고, Rock Corpus는 madmom 다운비트와 BeatNet에 유리하다. 이런 세트로 매긴 순위는 도메인 적합성이 아니라 "누가 그 데이터를 봤는가"를 반영한다. 이 세트들의 결과는 "본 데이터 참고치"로만 표기해야 한다. 둘째, MUSDB18은 위 학습 목록 어디에도 없다. 그래서 **GTZAN 다음으로 공정한 전곡 후보**다. 다만 이는 각 논문에 나온 학습 목록에서 추론한 것이고, BeatNet+ 자체는 14개 방법에 들어 있지 않다. librosa와 Essentia DSP 방법은 학습 가중치가 없으므로 누수 문제가 없다. 기본 파라미터가 공개 세트에 맞춰 조정되었다는 약한 설계 편향만 있다. Beat This! `fold*` 체크포인트를 쓰면 학습 세트 위에서도 공정한 교차검증 평가가 가능하다. 하지만 찬양 세트에서는 `final*`가 이미 깨끗하므로 굳이 쓸 이유가 없다.

## 찬양 정답은 클릭 스템, 모델 출력 수정, 메타데이터 순으로 싸다

**가장 정밀한 경로는 MultiTracks의 Click 스템이다.** MultiTracks 다운로드에는 Click과 Guide 스템이 들어 있다. 곡 페이지에는 녹음 세션 기준의 BPM과 박자가 적혀 있고, 템포 변화가 있는 곡에는 "tempo variations가 있으니 포함된 클릭을 쓰라"는 안내가 붙는다. 예를 들어 Graves Into Gardens 페이지에는 70 BPM, 6/8, 7분 31초가 표시된다 ([MultiTracks](https://www.multitracks.com/songs/Elevation-Worship/Graves-Into-Gardens/Graves-Into-Gardens/)). MultiTracks 측 인터뷰에서도 워십 밴드는 클릭으로만 트랙과 동기화한다고 말한다. 즉 이 생태계의 녹음은 대체로 클릭에 고정되어 있다 ([MultiTracks blog](https://multitracks.com/blog/all-about-worship-interview-with-multitracks-com)). 클릭은 깨끗한 임펄스라서 librosa 온셋 검출만으로 비트 시각이 나온다. 강세 클릭이 있으면 다운비트가 나오고, 클릭 간격에서 템포 전환과 램프가 포함된 템포 곡선이 나온다. 한국 쪽은 2024년 8월 문을 연 MultiTracks.co.kr이 WELOVE, J-US, Levites, Team Luke, Whole Life Worship을 다룬다. 마커스, 어노인팅, 예수전도단이 있는지는 확인하지 못했다 ([GospelMusic.org](https://gospelmusic.org/news/multitracks.com-launches-in-south-korea)). 약관은 "개인적·비상업적 사용"만 허용하고, 공유, 파생 녹음, 스크래핑을 금지한다. ML 분석에 관한 조항은 따로 없다 ([MultiTracks Terms](https://www.multitracks.com/terms/)). 구매한 사본을 개인적으로 분석하고 타임스탬프만 저장하는 방식이 위험이 가장 낮다. 다만 이는 법률 자문이 아니다. 주의할 점이 셋 있다. 멀티트랙 마스터와 스트리밍 발매본은 편집이나 페이드가 다를 수 있으므로, 합친 스템과 발매 음원을 상호상관으로 정렬하거나 합친 스템 자체로 평가해야 한다. 프리타임 인트로에서도 클릭이 계속 울릴 수 있다. 곡당 가격과 강세 클릭이 있는지는 확인하지 못했다.

**MultiTracks에 없는 곡은 "모델 출력 + 선택적 수정"이 비용 대비 효율이 가장 좋다.** 여러 트래커가 서로 일치하는 정도로 곡의 난이도를 예측할 수 있다. SMC 데이터셋도 이 원리로, 트래커들이 가장 엇갈리는 발췌만 골라 만들었다 ([Holzapfel et al. 2012](https://repositori.upf.edu/handle/10230/42182)). 그러니 Beat This!, madmom, librosa, Essentia, BeatNet을 모두 돌려서 일치하는 곡은 훑어보기만 하고, 엇갈리는 곡만 Sonic Visualiser에서 클릭 소리를 들으며 고친다. 사람이 직접 탭할 때는 보정이 필요하다. Driedger et al.의 예시에서 사람 탭은 **대개 오디오보다 약 80ms 앞섰다.** 그래서 탭 간격은 유지한 채 근처 활성화 피크에 스냅하는 보정을 제안했다. 같은 논문은 트래커 출력을 고치는 일도 탭을 고치는 것만큼 번거로울 수 있다고 지적한다 ([Driedger et al. 2019](https://www.audiolabs-erlangen.com/content/05_fau/professor/00_mueller/03_publications/2019_DriedgerSHM_BeatAnn_ISMIR_PrintedVersion.pdf)). 2026년에 나온 TimeCues Studio는 고정 BPM, 가변 템포, 수동 비트그리드 모드를 지원하고 JAMS로 내보낼 수 있어 대안이 된다 ([arXiv 2609.10338](https://arxiv.org/pdf/2609.10338)). 곡당 주석 시간이나 주석자 간 일치도 수치는 찾지 못했다. 처음 10곡의 소요 시간을 직접 재서 예산을 잡아야 한다.

**메타데이터는 비트 정답이 아니라 전역 BPM, 박자, 템포 변화 여부를 싸게 얻는 수단이다.** 신뢰도 순서는 MultiTracks(세션 클릭 기준), Planning Center 편곡 BPM·Meter 필드(SongSelect, PraiseCharts에서 가져옴), PraiseCharts(일부는 "Med Fast" 같은 단어 표기), 악보의 ♩= 표기 순이다 ([PCO](https://help.planningcenter.com/en/add-or-edit-an-arrangement.html), [PraiseCharts](https://praisecharts.com/songs/details/1822/still-sheet-music/lead-sheet-sat), [Musicnotes](https://www.musicnotes.com/sheetmusic/passion/sometimes/MN0091534_D4)). GetSongBPM과 Tunebat은 자체 알고리즘으로 추정한 값이다. 우리가 평가하려는 바로 그 옥타브 오류를 그대로 안고 있으므로 **정답으로 쓰면 순환 논리가 된다** ([GetSongBPM](https://getsongbpm.com/about)). Spotify audio-features는 2024년 11월 27일 이후 등록한 앱에는 막혀 있다 ([Spotify](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)). 메타데이터를 쓸 때는 옥타브 관례를 확인해야 한다. MultiTracks가 6/8 곡을 70 BPM으로 적는 것은 점4분음표 기준이다. 8분음표로 읽으면 210이 된다.

**악보·MIDI 정렬과 합성은 보조 수단이다.** Sync Toolbox(`pip install synctoolbox`)로 MIDI를 오디오에 DTW 정렬하면 비트 그리드를 옮겨 올 수 있다 ([JOSS](https://joss.theoj.org/papers/10.21105/joss.03434.pdf)). 하지만 한국 찬양 악보는 대부분 PDF나 이미지다. 녹음마다 후렴 반복 횟수와 키 업도 달라서 곡마다 형식을 손봐야 한다. 이 비용은 탭 후 수정보다 클 가능성이 높다. 악보는 박자와 명목 ♩=를 확인해 옥타브를 판정하는 용도로만 쓰는 편이 낫다. 리듬게임 차트(Clone Hero 등)에 CCM 곡이 있을 수도 있지만 확인하지 못했다. 커뮤니티 차트의 드럼 이벤트 중 ±100ms 안에 오디오 온셋이 있는 비율이 89%에 그친다는 보고도 있다 ([STRUM](https://arxiv.org/pdf/2605.12135)). 합성은 정답이 정확하고 공짜다. pretty_midi로 템포맵을 만들어 FluidSynth로 렌더하거나, 클릭이 있는 스템을 구간별로 time-stretch하면 된다. 하지만 패드, 리버브, 라이브 드리프트가 없어서 도메인 차이가 크다. **램프, 키 업, 박자 전환 같은 엣지 케이스의 단위 테스트**로만 쓴다.

## 평가 프로토콜: mir_eval 기본값의 함정 네 가지를 먼저 막는다

첫째, `mir_eval.beat.evaluate()`는 기본적으로 **기준과 추정 모두에서 앞 5초를 잘라낸다** ([mir_eval beat.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py)). 찬양곡의 첫 5초는 대개 패드나 피아노 인트로이고, 트래커가 가장 많이 틀리는 곳이다. Beat This! 저자들도 이 트림에 "꼭 찬성하지는 않는다"고 했다 ([Foscarin et al. 2024](https://arxiv.org/html/2407.21658)). 5초 트림과 `min_beat_time=0` 두 가지를 모두 보고한다. 둘째, AML 변형은 원본, 엇박, ×2, ½(홀수), ½(짝수)의 다섯 가지뿐이다. **×3이나 ⅓ 변형이 없어서** 6/8 곡의 점4분음표와 8분음표 혼동은 AML로도 오답 처리된다. 셋째, mir_eval에는 Acc1/Acc2 함수가 없다. `mir_eval.tempo.detection`은 8% 허용오차의 MIREX P-score이고 Acc1/Acc2가 아니다 ([mir_eval tempo](https://mir-eval.readthedocs.io/latest/api/tempo.html)). Acc1은 `|est−ref| ≤ 0.04·ref`로, Acc2는 ref×{1, 2, 3, ½, ⅓}로 직접 구현한다. 6/8용으로 ×1.5와 ⅔는 별도의 진단 칸으로 둔다. 넷째, information gain은 mir_eval에서 0–1로 정규화되지만 Beat Evaluation Toolbox는 비트 단위로 보고한다. 두 척도를 한 표에 섞으면 안 된다.

Schreiber et al.은 이진 지표인 Acc1/Acc2가 오류의 방향과 크기를 숨긴다고 지적했다. 그 대신 **OE = log2(추정/정답)와 그 절댓값 AOE**를 쓰라고 권한다 ([Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)). OE 히스토그램을 그리면 ±1(반/두 배)과 ±1.58(3배) 근처에 모인 옥타브 오류가 작은 템포 오차와 깔끔하게 갈린다. 같은 연구에서 데이터셋의 충분성(Φ ≥ 0.95)을 따져 보니, Acc1/Acc2로는 ISMIR04, Ballroom, GiantSteps 정도만 충분했지만 OE1로는 7개 세트 모두가 충분했다. 이 결과는 **곡 수가 적을수록 연속 지표가 필수**라는 뜻이다. 비트 수준에서는 F1, CMLt, AMLt를 주 지표로 쓴다(문헌과 비교할 수 있다). 여기에 AMLt−CMLt를 "위상과 주기는 맞았지만 메트릭 레벨이 틀린 비율"로 따로 보고한다. 다운비트는 같은 함수에 다운비트 시각을 넣어 평가한다.

템포 전환은 표준 지표가 없으므로 직접 정의해야 한다. 정답 비트에서 약 8비트 창의 중앙 IBI로 국소 BPM을 구하고, 추정 쪽도 같은 방식이나 librosa PLP·동적 템포 곡선으로 구한다. 두 곡선이 ±4% 안에 드는 프레임 비율(국소 Acc1, Acc2)을 잰다. 4% 이상 변하는 지점에는 경계를 표시하고, 약 ±2마디 허용오차로 템포 변화 지점의 precision과 recall을 매긴다. 이 방식은 자체 프로토콜이며 출판된 표준은 없다. 메트릭 레벨 전환을 다룬 기존 연구로는 annotation coverage ratio가 있다 ([Chiu et al. 2022](https://arxiv.org/abs/2210.06817)). 템포 불안정은 전역 지표를 크게 흔든다. SMC에서 c_var < 0.1인 곡만 남기자 Böck 방법의 Acc2가 18.4포인트 올랐다 ([Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)). 따라서 곡마다 정답의 c_var를 함께 기록해야 드리프트의 영향이 드러난다.

찬양에 특히 중요한 함정이 둘 더 있다. madmom DBN과 Beat This! `--dbn`은 기본으로 **55–215 BPM 범위와 마디당 3·4박을 강제한다.** SMC에서는 55 BPM 하한 때문에 21%의 곡에서 정답 템포를 아예 추론할 수 없었고, 느린 곡은 두 배 템포로 밀려났다 ([SMC Blind Spot](https://arxiv.org/abs/2605.12287), [postprocessor.py](https://github.com/CPJKU/beat_this/blob/main/beat_this/model/postprocessor.py)). 60–70 BPM대 찬양 발라드에서는 이 사전분포가 옥타브 판정을 직접 결정한다. 그러니 "+DBN" 변형의 결과는 모델 성능이 아니라 사전분포 설정의 효과로 해석해야 한다. 또 DBN을 붙이면 Beat This!의 비트 F1은 89.1에서 88.1로 떨어지지만 다운비트 CMLt는 67.3에서 73.3으로 오른다. 어느 지표를 보느냐에 따라 DBN의 득실이 뒤집힌다 ([Foscarin et al. 2024](https://arxiv.org/html/2407.21658)). 전곡 평가에는 구간 마스크도 필요하다. 펄스 없는 인트로와 아웃트로, 프리타임, 기도 멘트, 박수, 페이드를 표시하고, 전곡 점수와 펄스 구간 점수를 따로 낸다. 하프타임 브릿지는 "느껴지는 박"과 대체 레벨을 둘 다 저장해서, 레벨 선택 차이가 추적 실패로 섞이지 않게 한다.

## 500곡 상황에 맞춘 권장 계획: 정답을 세 층으로 쌓는다

표본 크기 추정부터 계획을 정해야 한다. 아래는 노트의 정규근사 계산이며, 곡별 차이의 표준편차를 0.15로 가정했다. 두 방법의 F1 차이가 5%p라면 약 70곡, 3%p라면 약 200곡이 필요하다. 이진 Acc1을 McNemar로 비교하면 5%p 차이에도 약 300곡, 3%p 차이에는 약 870곡이 필요하다. 즉 **비트 정답 100곡 정도로는 큰 차이만 가려낼 수 있고, 전역 템포 비교는 500곡 전체에 걸쳐 AOE 같은 연속 지표로 해야 검정력이 생긴다.** 그래서 "정밀하지만 적은 정답"과 "대략적이지만 많은 정답"을 층으로 나누는 구조가 맞다.

| 층 | 곡 수 | 정답 내용 | 만드는 법 | 쓰임 |
|---|---|---|---|---|
| A. 정밀 | 30–50 | 비트, 다운비트, 템포 곡선, 구간 마스크 | MultiTracks(.co.kr) 구매 → Click 스템 온셋 검출 → 발매본과 정렬 | 템포 전환 평가, 다른 층의 오류율 검증 |
| B. 수정 | 약 100 | 비트, 다운비트 | 5개 트래커 실행 → 불일치 곡 우선 → Sonic Visualiser 수정 | F1, CMLt, AMLt 순위, 다운비트 |
| C. 전역 | 500 전체 | 전역 BPM(박 단위 명시), 박자, 템포 변화 여부 | MultiTracks/PCO/악보 ♩= + 모델 합의, 불일치만 청취 확인 | Acc1, Acc2, AOE, 옥타브 오류 분포 |
| 보조 | — | 공개 세트 | GTZAN(수정 주석), MUSDB18+BeatNet+ | 문헌 비교, 30초 대 전곡 효과 분리 |
| 단위 테스트 | 수십 | 합성 램프, 키 업, 박자 전환 | pretty_midi + FluidSynth 또는 스템 time-stretch | 엣지 케이스 회귀 확인 |

우선순위는 이렇다. **1순위는 평가 코드를 먼저 고치는 일이다.** 5초 트림 두 버전, 직접 구현한 Acc1/Acc2(×3, ⅓ 포함), ×1.5 진단 칸, OE/AOE, 곡별 결과 저장을 갖춘다. 이 작업은 현재 정답 3곡과 GTZAN만으로 바로 할 수 있다. 데이터를 늘리기 전에 측정 도구가 맞아야 한다. **2순위는 옥타브 정책을 문서로 확정하는 일이다.** 정답 BPM은 클릭이나 기보상의 박 단위로 정한다(4/4는 4분음표, 6/8과 12/8은 점4분음표). "느껴지는 ×2·½"는 별도 필드에 둔다. 이 결정 없이 C층 라벨을 붙이면 나중에 전부 다시 해야 한다. **3순위는 A층 10곡 파일럿이다.** 곡당 비용, 강세 클릭 유무, 발매본 정렬 난이도를 확인하고, B층 주석 시간을 재며, 곡별 차이의 분산 σ_d를 실측해서 B층 규모를 다시 계산한다. **4순위가 B층과 C층 확장**이고, 5순위가 MUSDB18 보조 평가와 합성 단위 테스트다. 전곡 결과와 함께 같은 곡에서 무작위로 자른 30초 창의 결과도 내면, GTZAN과의 차이가 길이 때문인지 장르 때문인지 갈라진다.

Kaggle에서만 연산한다는 조건에서는 이 계획의 무거운 부분이 둘뿐이다. 하나는 14개 방법을 500곡 전곡에 돌리는 추론이고, 다른 하나는 선택적 샘플링용 다중 트래커 실행이다. 둘 다 같은 노트북 실행 하나로 처리된다. 주석 작업(Sonic Visualiser, TimeCues)과 클릭 스템 온셋 검출은 로컬 노트북으로 충분하다. 음원은 비공개 데이터셋으로만 올리고, 결과물로는 곡 ID와 타임스탬프만 남긴다. 그러면 MultiTracks 약관과 저작권 위험을 동시에 줄일 수 있다. 긴 파일은 도구마다 청크로 나눠 처리하거나 길이를 제한할 수 있다. 예를 들어 DeepRhythm 벤치마크는 8초 클립을 기준으로 한다 ([benchmarks.md](https://github.com/bleugreen/deeprhythm/blob/main/docs/benchmarks.md)). 그러니 방법별 처리 모드를 실행 로그에 남겨야 한다. 14개 방법의 쌍별 비교에는 Wilcoxon이나 paired bootstrap(곡 단위 재표본)과 Holm 보정을 쓰고, 전체 순위에는 Friedman과 Nemenyi 사후검정을 쓴다. Beat This! final과 small의 GTZAN F1 차이는 0.3에 불과하다 ([Foscarin et al. 2024](https://arxiv.org/html/2407.21658)). 이 정도 차이는 시드 노이즈 범위로 봐야 한다.

## Conclusion

이번 조사로 질문의 무게중심이 바뀌었다. 처음 질문은 "어떤 공개 데이터셋을 더 붙일까"였지만, 실제 답은 **"공개 데이터셋은 누수 때문에 순위를 매길 수 없고, 찬양 정답은 클릭 스템 덕분에 생각보다 싸다"**에 가깝다. 공개 전곡 세트는 모델마다 유불리가 엇갈리는 참고치일 뿐이다. 찬양 세트는 14개 방법 모두에 깨끗한 유일한 전곡 데이터이므로, 연구의 본체가 된다. 특히 클릭 기반 정답은 공개 데이터셋 어디에도 없는 "의도된 템포 전환의 정확한 위치"를 준다. 그래서 GTZAN으로는 원리적으로 잴 수 없던 템포 전환 추종 능력을 처음으로 측정할 수 있다.

남은 불확실성도 분명하다. 한국 주요 워십팀(마커스, 어노인팅, 예수전도단)의 클릭 스템을 구할 수 있는지, MultiTracks 곡당 비용, 사람 주석의 곡당 소요 시간, DeepRhythm의 학습 데이터는 모두 확인되지 않았다. 앞의 셋은 10곡 파일럿으로 한 주 안에 답할 수 있다. DeepRhythm은 어떤 공개 세트에서도 "출처 불명"으로 표기하고 찬양 세트 결과로만 판단하는 것이 정직하다. 마지막으로, 측정해 보면 "+DBN" 변형과 librosa/Essentia의 BPM 범위 설정이 느린 찬양 발라드의 옥타브 판정을 모델 자체보다 더 크게 좌우할 가능성이 높다. 그렇다면 14개 방법 비교와 별도로, 후처리 사전분포를 찬양 템포 분포에 맞게 조정하는 실험이 가장 값싼 성능 개선 수단이 될 수 있다.
