# 악보 이미지 → MusicXML 변환 정확도 (sheet-to-musicxml)

이전 시험: [audio-sheet-to-arrangement-form/experiments/songform-crop-stt](../../../audio-sheet-to-arrangement-form/experiments/songform-crop-stt/) (악보 가사·key·마디·코드 일부 확인)

## 목표
악보 이미지를 **정확한 MusicXML**로 옮기는 방법을 찾는다. 가사보다 **음표(피치·리듬)**가 우선.

## 채점 기준 (우선순위 순)
| 항목 | 지표 |
|---|---|
| 음표·쉼표 (피치, 리듬) | musicdiff OMR-NED (`DetailLevel.NotesAndRests`, 낮을수록 정확) |
| 조표·박자표 | OMR-NED (`Signatures`) |
| 마디선·반복·엔딩 | OMR-NED (`Barlines`) |
| 코드 기호 | OMR-NED (`ChordSymbols`) |
| 가사 | OMR-NED (`Lyrics`) |
| 전체 | OMR-NED (`AllObjects`) |

## 평가 세트
- **A. 정답 세트**: OpenEWLD(퍼블릭 도메인 리드시트 502곡, MIT)에서 조건(1성부, 코드·가사 있음, 3/4·4/4, 16~48마디, 1페이지)에 맞는 20곡을 고정 시드로 뽑아 Verovio로 이미지 렌더링. 원본 MusicXML이 정답. 변형 2종: **clean**(약 200dpi) / **lowres**(가로 900px + JPEG 품질 60, 블로그 악보 수준)
- **B. 실제 악보 세트**: 앞선 시험의 찬양 악보 14장. 정답이 없으므로 정답 없이 되는 검사만: 마디별 박자 합 일치율, key·박자(이미 8/8 확인)
- 저작권 악보의 멜로디는 사람이 옮겨 적지 않고, 결과 보고에도 수치만 씀

## 후보
1. **Audiveris 5.11** (무료 OMR) — 기준선
2. **비전 LLM → ABC → MusicXML** (Qwen3-VL, Kaggle GPU) — ABC 표기로 생성 후 music21로 변환
3. (키 필요, 보류) Flat/Opuscan OMR API, Gemini
4. (결과 보고 결정) 하이브리드: Audiveris 구조 + VLM 보완

## 절차
1. Kaggle CPU 커널 `sheet-xml-audiveris`: 세트 A 선정·렌더링 → Audiveris(A+B) → musicdiff 채점
2. Kaggle GPU 커널 `sheet-xml-vlm`: 같은 이미지 → Qwen3-VL → ABC → MusicXML → 채점
3. 결과를 새 아티팩트에 모델 출력·점수만 정리
4. 모든 단계는 [LOG.md](LOG.md)에 기록. 로컬 리소스는 쓰지 않음(스크립트 문법 확인 정도만)

## 절차 B: 영역 박스 검출 (오선 / 코드 / 가사) — 2026-09-29 추가
목표: Audiveris가 코드를 셈여림으로 오인식하고 가사를 놓치는 문제를 우회하기 위해, 악보를 세 영역으로 나눠 각각 따로 인식할 수 있는지 본다.
- **오선 영역**: 5줄 오선 + 오선 밖으로 나간 꼬리·빔·덧줄 음표까지 포함 (사용자 조건). OpenCV 오선 검출 → 오선에 닿은 연결 요소를 모두 합쳐 박스 확장 → 오선 가까이 떨어진 비텍스트 조각(덧줄 온음표 등)도 포함.
- **코드 영역**: EasyOCR(ko+en) 글자 박스 중 오선 위 약 5줄 간격 안의 한글 아닌 글자.
- **가사 영역**: 오선 아래의 한글 글자 박스.
- 커널: `kaggle/regions` (gunhe17/sheet-regions, CPU). 결과는 원본 위에 박스를 그린 그림으로 사람이 먼저 판정 → 통과하면 영역별 인식과 마디 붙이기로 진행.
