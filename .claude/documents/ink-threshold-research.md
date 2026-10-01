# 악보 잉크 판정(이진화) 기준 조사 — 2026-10-01

질문: 문서별 잉크 기준을 꼭 오선으로 잡아야 하나? 전형적인 방법은?

## 1. 악보 인식(OMR) 분야의 전형
- **오선은 OMR의 기준 자로 쓰인다.** 대부분의 OMR은 오선 두께(staffline height)와 오선 간격(staffspace height) 두 값을 먼저 재서, 이후 기호 크기 판단에 쓴다. 측정 방법은 열마다 세로 방향 흑/백 연속 길이(run-length)를 세어, 가장 흔한 검은 길이 = 오선 두께, 가장 흔한 흰 길이 = 오선 간격으로 보는 것(RLE 히스토그램). [Rebelo et al. 2012 OMR 리뷰]
- **Audiveris**도 BINARY 단계(이진화) 뒤 SCALE 단계에서 세로 run-length 히스토그램으로 오선 간격·두께·빔 두께를 잰다. 연한 회색 악보 이진화 문제는 사용자 조정 보드로 다룬다(5.4부터). [Audiveris 문서, Discussion #703]
- **오선 지식을 이진화 기준에 쓰는 방법도 이미 있다.** Pinto·Rebelo·Cardoso (IbPRIA 2011) "Music Score Binarization Based on Domain Knowledge": 회색 악보에서 직접 오선 두께와 오선 간격만 추정해 이진화 기준을 정한다. 악보 내용 지식을 의도적으로 쓰는 거의 유일한 임계값 방법으로 소개됨. → 우리 0단계(오선 진하기로 기준)와 같은 계열.
- 회색 영역에서 바로 오선을 검출·제거하는 연구도 있음(Staff line detection and removal in the grayscale domain).

## 2. 일반 문서 이진화 분야의 전형 (분포·국소 방법)
- **전역 분포 방법**: Otsu(1979, 두 집단 분리), 다단계 Otsu(종이/중간/잉크 세 집단), Kittler–Illingworth 등 — 페이지 전체 회색 히스토그램의 골짜기를 찾음.
- **국소 적응 방법**: Niblack(1985), Sauvola(2000) — 주변 창의 평균·분산으로 픽셀별 기준. 조명 불균일, 흐린 글자에 강함. AdOtsu(Otsu의 국소화), SauvolaNet(학습형) 등 변형.
- **배경 추정 방법**: 배경(종이·얼룩)을 먼저 추정해 빼거나 나눈 뒤 이진화(배경 추정 + 획 경계 방법 등).
- **워터마크 제거**는 열화 문서 이진화의 한 유형으로 다뤄짐(배경 질감, 번짐, 흐린 획과 함께). DIBCO 대회(2009–2019)가 표준 벤치마크. 최근은 GAN·확산 모델 기반 복원도 있음.

## 3. 우리 문제에 대입
| 방법 | 장점 | 우리 악보에서의 위험 |
|---|---|---|
| 오선 기준(현재 0단계, Pinto 계열) | 가장 가는 획(오선)이 살아남는 기준을 직접 보장 | 오선을 먼저 찾아야 함(닭과 달걀), 한 오선만 스타일이 다르면 놓침 |
| 전역 분포(다단계 Otsu, 골짜기) | 오선 검출 없이 바로 가능, 워터마크가 별도 봉우리면 분리 가능 | 종이가 90% 이상이라 잉크·워터마크 봉우리가 작음, 연한 오선과 워터마크 회색이 겹치면 분리 불가 |
| 국소 적응(Sauvola 등) | 연한 스캔·조명 차이에 강함 | 워터마크 가장자리도 잉크로 잡음(실제로 적응형 이진화가 워터마크 테두리를 잡았던 경험 있음) |
| 혼합: 분포에서 후보 골짜기를 찾고, 오선·음표 머리로 어느 골짜기인지 고름 | 둘의 약점 보완 | 구현 단계 하나 더 |

## 출처
- Optical music recognition: state-of-the-art and open issues — https://link.springer.com/article/10.1007/s13735-012-0004-6
- Music Score Binarization Based on Domain Knowledge — https://link.springer.com/chapter/10.1007/978-3-642-21257-4_87
- Staff line Detection and Removal in the Grayscale Domain — https://www.academia.edu/4504624/Staff_line_Detection_and_Removal_in_the_Grayscale_Domain
- A Robust Staff Line Height and Staff Line Space Estimation — https://www.semanticscholar.org/paper/A-Robust-Staff-Line-Height-and-Staff-Line-Space-for-Na-Kim/86af8c06f0d271147d04edc918dc0aba06d5a43d
- Introduction to OMR: Overview and Practical Challenges — https://ceur-ws.org/Vol-1343/paper6.pdf
- Audiveris light grey binarization discussion — https://github.com/Audiveris/audiveris/discussions/703
- Audiveris updates — https://audiveris.github.io/audiveris/_pages/reference/updates/
- SauvolaNet — https://arxiv.org/pdf/2105.05521
- AdOtsu — https://www.sciencedirect.com/science/article/abs/pii/S0031320311005140
- Background estimation and stroke edges — https://www.researchgate.net/publication/220163435_Document_image_binarization_using_background_estimation_and_stroke_edges
