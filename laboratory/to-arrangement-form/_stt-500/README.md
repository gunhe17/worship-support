# 찬양 500곡 STT (Whisper large-v3, 원곡 믹스)

- 왜: [songform-crop-stt](<../구간별 STT 가사를 악보 가사와 대조하면 송폼 part를 판정할 수 있다/songform-crop-stt/>)에서 찬양 10곡 정답 가사 대비 가장 정확했던 설정(CER 중앙값 0.107)을 500곡 전체에 돌린다. 구간 자르기 없이 곡 전체.
- 커널: `gunhe17/worship-stt-500` (T4), 코드 [kaggle/run.py](kaggle/run.py). 입력은 비공개 데이터셋 `gunhe17/worship-audio-500`.
- 출력: `results/out/<id>.json` = 곡마다 `segments: [[시작, 끝, 가사], ...]`. 음원·가사는 저작물이라 결과도 공개하지 않는다.
- 알려진 문제: 노래 구간에서도 "한글자막 by …", "감사합니다" 같은 환각 문구를 낸다 (songform-crop-stt에서 구간의 7.5%). 후처리로 걸러야 한다.

## 결과 (2026-10-14)
- 커널 v2: 500곡 모두 성공, 9,850초(2.7시간), 곡당 중앙값 16.6초. v1은 faster-whisper가 파일을 PyAV로 읽다 Kaggle의 새 PyAV와 맞지 않아(`metadata_errors`) 전부 실패 → ffmpeg로 16 kHz 모노 배열을 만들어 넘김.
- 결과는 가사(저작물)라 git에서 뺐다 (`.gitignore`의 `results/`). 로컬 `results/out/<id>.json`.
- 환각 문구가 여러 곡에 반복된다: "한글자막 by 한효정" 160, "한글 자막 by 한효정" 36, "한글자막 by 박진희" 31, "한글자막 by 한효주" 30, "감사합니다." 82, "다음 영상에서 만나요." 34 (구간 수). 쓰기 전에 걸러야 한다.
