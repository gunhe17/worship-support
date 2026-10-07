# 3. Audio + Sheet → Arrangement form

곡 오디오와 악보를 함께 써서 **실제 연주된 구간 순서**를 돌려준다 (예: Intro > Verse 1 > Pre-Chorus > Chorus > … > Chorus(key up)).

## 현재 상태
- 실험: [experiments/songform-crop-stt](experiments/songform-crop-stt/) (10곡 10팀). 흐름은 SongFormer 송폼 → 구간 crop(±1.5초) → 구간별 STT → 악보 가사와 대조.
- STT: 정답 가사 대비 CER은 **Whisper large-v3 + 원곡 믹스가 가장 정확**했다 (중앙값 0.107). Qwen3-ASR은 0.24, ghost613은 쓸 수 없는 수준이었다.
- part 판정: 구간 STT를 악보의 태그된 가사와 정렬하니 가사 있는 crop의 **85%에 part가 붙었다**. LLM 없이 텍스트 대조만으로 된다. Verse 1/2/3 번호까지 구분되고, SongFormer 라벨 오류도 드러난다.
- 남은 일: 악보 이미지에서 태그된 가사를 추출하는 단계(지금은 사람/Claude가 직접 읽음 → 기능 4와 연결), 애드리브·멘트 구간 처리, 악보 없는 곡 처리.
- 첫 측정은 [_common/experiments/audio-analysis-test](../_common/experiments/audio-analysis-test/)에 있다 (3곡 SongFormer 420/180초 창, 전체 곡 STT).

## 파일
- [survey-audio.md](survey-audio.md): 곡 구조 조사 종합 (경계·라벨링, 가사 기반, audio LLM, 예배 제품, 권장 파이프라인)
- [sources/](sources/): Claude·Grok 곡 구조 조사 원문
- [survey-stt/](survey-stt/): 한국어 STT 조사 (가창 인식, forced alignment)
- 공통 조사: [../_common/audio-survey-overview.md](../_common/audio-survey-overview.md)
