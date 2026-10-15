# Arrangement (곡 구조) 조사 — 오디오

- 조사일: 2026-09-28
- 목적: 곡 오디오 파일을 입력하면 **key(곡 중 key up/down 포함)**, **arrangement(예: Verse > Chorus)**, **BPM**을 반환하는 기능의 측정 방법 조사
- 대상 도메인: 예배/CCM 곡 (스튜디오 음원 + 라이브 녹음)

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

