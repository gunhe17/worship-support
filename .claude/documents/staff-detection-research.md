# 오선 검출 일반화 조사 — 2026-10-01

배경: "구조 먼저" 방식(진하기 무관 가로선 반응 → 행별 중앙값 → 줄 간격 p의 5줄 빗)이 100장 700개 중 697개를 찾음. 놓친 3개 = 짧은 마지막 오선(제이어스, 선이 판정 범위의 48%), 손그림의 기울고 구불구불한 오선(복음성가 2개, 같은 선이 열마다 최대 95px 다른 행).

## 1. 연구에서 오선을 찾는 방식
- **투영(projection) 방식**: 행별 검은 픽셀 수 봉우리로 선을 찾음. 단순하지만 기울기·곡률에 약함 → 보통 기울기 보정(회전) 후 적용. (우리 현재 방식이 이 계열)
- **세로 run-length로 척도 먼저**: 오선 두께·줄 간격을 RLE 히스토그램으로 먼저 잼(OMR 표준). 이후 모든 기준을 이 척도에 비례해서 정함. [Rebelo et al. 2012]
- **선 추적(line tracking)**: Gamera MusicStaves 도구 모음의 여러 알고리즘(Dalitz 등). Dalitz et al. 2008 "A comparative study of staff removal algorithms"(IEEE TPAMI)은 회전·곡률·인쇄 흉내·흰 반점 같은 **인공 변형**을 악보에 가해 알고리즘을 비교 — 일반화 시험 방법으로 쓸 만함.
- **안정 경로(stable paths)**: Cardoso·Capela·Rebelo(2008–2009). 페이지 왼쪽 끝과 오른쪽 끝을 잇는 "어두운 쪽으로 가는 최단 경로" 중 양방향에서 똑같이 나오는 경로를 오선으로 봄. **기울기, 끊김, 곡률에 본래 강함**, 사전 지식 없이 동작. 손그림 악보에서 Dalitz 방식보다 좋았다고 보고.
- **Audiveris**: 가로 "필라멘트"(가는 선 조각의 핵)를 모아 매끄러운 곡선(스플라인)으로 표현하고, 오선과 마디선으로 격자(grid)를 만들어 이를 기준 좌표로 씀 → 전처리 없이 기울기·왜곡 처리. 빔에 가려 필라멘트가 끊기면 실패할 수 있음.
- **손그림 데이터셋·대회**: CVC-MUSCIMA(손그림 악보 1,000장, 작성자 50명), ICDAR 2013 오선 제거 대회(9개 방법). 손그림 오선은 "곧지도 수평이지도 평행하지도 않고, 한 페이지 안에서도 오선마다 기울기가 다르거나 휜다".
- **딥러닝**: 픽셀을 오선/기호/배경으로 분류하는 CNN·U-Net(F-measure 약 98.6% 보고), oemer도 이 계열. 학습 데이터·GPU 필요.

## 2. 우리 문제에 대입한 일반 규칙 (제안)
오선의 정의를 "페이지 폭 비율"이 아니라 **문서 척도(줄 간격 p, 선 두께) 기준의 구조**로 바꾼다.

> 오선 = 가늘고 어두운 선 **추적선(track) 5개**가 (1) 서로 거의 평행하게 (2) 간격 ≈ p를 유지하며 (3) 같은 가로 구간을 함께 지나고 (4) 그 길이가 p의 일정 배수 이상인 것.

- **짧은 오선**: 길이 기준을 페이지 폭의 비율 → **줄 간격의 배수**(예: 8p 이상 ≈ 한두 마디)로. 판정은 페이지 전체 중앙값이 아니라 **세로 띠별**로 하고, 오선의 가로 구간은 추적 결과로 정함. → 마지막 줄, 코다·인트로 조각 오선, 중간에 끊긴 오선을 같은 규칙으로 처리.
- **손그림·기운 오선**: 세로 띠(폭 ≈ 4–6p)마다 5줄 빗을 찾고, 이웃 띠의 빗을 위아래 ±p/2 안에서 이어 붙여 추적선을 만듦(선 추적·안정 경로의 단순판). 이빨 허용 오차를 고정 px → **p의 비율(예: ±0.25p)**로.
- **오탐 방지**: 상자 테두리·반복 괄호·가사 밑줄은 "평행한 5줄이 간격 p로 함께 이어지는" 구조가 아니므로 걸러짐. 추가로 선 두께가 문서의 오선 두께와 비슷한지 확인.
- **일반화 검증**: Dalitz 방식처럼 깨끗한 악보에 회전(1–3°), 휘어짐, 해상도 저하, 짧게 자르기 같은 인공 변형을 가해 놓치는지 측정 + 실제 100장에서 700개·가짜 0개 유지.

## 출처
- Staff line detection and removal with stable paths (Capela, Rebelo, Cardoso 2008) — https://www.inescporto.pt/~jsc/publications/conferences/2008ACapelaSIGMAP.pdf
- Staff Detection with Stable Paths (2009) — https://www.academia.edu/4504636/Staff_Detection_with_Stable_Paths
- A Connected Path Approach for Staff Detection on a Music Score — https://pages.up.pt/~up367235/publications/conferences/2008JaimeICIP.pdf
- A Shortest Path Approach for Staff Line Detection — https://www.researchgate.net/publication/4298910_A_Shortest_Path_Approach_for_Staff_Line_Detection
- Optical music recognition: state-of-the-art and open issues — https://link.springer.com/article/10.1007/s13735-012-0004-6
- OMR: State of the Art and Major Challenges — https://arxiv.org/pdf/2006.07885
- Audiveris updates — https://audiveris.github.io/audiveris/_pages/reference/updates/
- CVC-MUSCIMA — https://www.researchgate.net/publication/225445011_CVC-MUSCIMA_A_ground_truth_of_handwritten_music_score_images_for_writer_identification_and_staff_removal
- Staff-Line Detection on Grayscale Images with Pixel Classification — https://www.researchgate.net/publication/317104965_Staff-Line_Detection_on_Grayscale_Images_with_Pixel_Classification
- Staff Line Removal Using Line Adjacency Graph and Staff Line Skeleton for Camera-Based Printed Music Scores — https://www.researchgate.net/publication/286724954_Staff_Line_Removal_Using_Line_Adjacency_Graph_and_Staff_Line_Skeleton_for_Camera-Based_Printed_Music_Scores
