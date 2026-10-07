# 찬양 음원 500곡 (audio-500)

key·BPM·arrangement 연구용 음원. **개인 연구용, 배포 금지.** 음원은 git에서 제외(`audio/`)하고 Kaggle에는 비공개 데이터셋으로만 올린다.

- 출처: 한국 찬양팀 23팀의 **공식 YouTube 채널** (`collect.py`의 `CHANNELS`, 검색 결과에서 눈으로 확인)
- 고르는 법: 채널 업로드 중 길이 2.5–12분, MR·반주·Shorts·멘트·풀영상·커버 제외, 같은 제목 중복 제거 → 조회수 순 → 팀별로 돌아가며 뽑아 500곡 (팀당 최대 24곡)
- 악보와 짝짓지 않는다 (곡 선택은 음원 기준으로만)
- 목록: `songs.json` (id, 팀, 제목, 채널, 길이, 조회수, URL)
- 음원: `audio/<id>.<ext>` (yt-dlp `bestaudio` 원본 형식 그대로, 변환은 Kaggle에서)
- 처음 다운로드에서 30곡 실패(받을 수 없음 20, YouTube 요청 제한 10) → `refill`로 받을 수 없는 20곡을 같은 팀 다음 순위 곡으로 교체하고 30곡을 다시 받음 → **500곡 완료** (2026-10-07). 교체 전 목록: `songs.before-refill.json`
- Kaggle 비공개 데이터셋: `gunhe17/worship-audio-500` (`kaggle-dataset/`은 `audio/` 하드링크 + `songs.json`, git 제외)
- 정답(key·BPM)은 없음

```
python collect.py list       # 채널 → songs.json
python collect.py download   # songs.json → audio/ (archive.txt로 이어받기)
python collect.py refill     # 받을 수 없는 곡을 같은 팀 다음 순위로 교체
```
