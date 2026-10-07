# 송폼 구간별 STT 시험 (songform-crop-stt)

이전 시험: [../audio-analysis-test/](../audio-analysis-test/) (key·BPM·송폼·전체 곡 STT)

## 목표
1. 곡 pool을 **약 10곡**으로 늘린다 (한국 찬양팀, 공식 영상).
2. 각 곡의 송폼(구간)을 모델로 추출한다.
3. 각 구간 오디오를 **앞뒤 여유(padding)를 두고 잘라(crop)** STT를 돌린다.
4. 결과를 모델 출력 그대로 새 아티팩트에 정리한다.
5. **송폼 검토 절차는 사용자가 이 결과를 보고 제시한다.** 이 시험에서는 검토(병합, 라벨 재부여 등)를 하지 않는다.

## 절차
1. **곡 수집**: 기존 3곡 + 신규 약 7곡. 팀, 곡명, 공식 YouTube URL을 `songs.json`에 기록
2. **음원 확보**: `yt-dlp` → 44.1kHz mono WAV, `audio/`에 저장 (git 제외, 개인 시험용)
3. **Kaggle 업로드**: 비공개 데이터셋 `gunhe17/worship-songform-pool`
4. **Kaggle 실행** (T4, 비공개 커널 `gunhe17/worship-songform-crop-stt`)
   1. 보컬 분리: Demucs htdemucs → vocals stem
   2. 송폼 추출: SongFormer (180초 창 — 420초 창은 T4에서 6분 전후 곡이 OOM)
   3. 구간 crop: 각 구간 `[start − 1.5초, end + 1.5초]` (곡 범위 안으로 제한)
   4. 구간 STT: 모델 3개 × 입력 2종 (믹스 / 보컬)
      - Whisper large-v3 (faster-whisper, VAD 없음)
      - ghost613/whisper-large-v3-turbo-korean
      - Qwen3-ASR-1.7B
5. **리포트**: 새 아티팩트 (곡별로 구간 × 모델 × 입력 STT 결과)
6. **기록**: 각 단계는 [LOG.md](LOG.md)에 남긴다

## 결정 사항
- padding 1.5초: 이전 시험에서 SongFormer 경계가 약 2~4초 어긋났던 점을 고려한 값. 결과를 보고 조정
- 가사가 없을 것 같은 구간(intro, inst 등)도 **건너뛰지 않고** STT를 돌림. 검토 규칙은 사용자가 정함
