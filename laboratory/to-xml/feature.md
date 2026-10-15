---
type: feature
title: To Xml
---

악보 이미지(찬양 리드시트: 오선 + 코드 + 한글 가사)를 **MusicXML**로 옮긴다. 가사보다 음표(피치, 리듬)가 우선이다.

## 현재 상태
- 실험: [experiments/sheet-to-musicxml](<OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다/sheet-to-musicxml/>). 채점은 musicdiff OMR-NED, 정답 세트는 OpenEWLD를 렌더링해서 만들었다.
- 비교 결과: 구조(마디, 조표, 박자)는 **Audiveris**, 가사·코드는 **비전 LLM(Qwen3-VL)**으로 역할을 나눈다. 둘을 뒤집을 도구는 없었고, 시험할 만한 상용 후보는 Opuscan(Flat.io) 하나가 남아 있다.
- 진행 중: **악보 영역 분리**(오선 / 상단 기호 / 가사 행). 100장 기준으로 오선 누락 2건, 기호와 가사가 섞인 행 19개가 남았다. 이어서 할 작업은 resume.claude.md(삭제됨)의 "오선 누락 수정"이고, 기준 문서는 실험 폴더의 `STAFF_DETECTION.md`와 `PARAMETERS.md`다.
- 앞선 악보 시험(Audiveris 한글 가사 CER, Qwen3-VL 가사 추출)은 [songform-crop-stt](<../to-arrangement-form/구간별 STT 가사를 악보 가사와 대조하면 송폼 part를 판정할 수 있다/songform-crop-stt/>) LOG 9–11에 있다.

## 파일
- [survey-tools/](_survey/survey-tools/): 변환 도구 조사 (OMR, 상용 도구)
- [survey-vision-ocr/](_survey/survey-vision-ocr/sources/): 비전 모델·OCR 조사 원문
- [staff-detection-research.md](_survey/staff-detection-research.md), [ink-threshold-research.md](_survey/ink-threshold-research.md): 오선 검출, 잉크 기준 조사
