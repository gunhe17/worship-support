# AI 기능 연구

연구 대상 기능 4가지. 기능마다 폴더 하나를 둔다.

| # | 기능 | 입력 → 출력 | 폴더 |
|---|---|---|---|
| 1 | Audio → Key | 곡 오디오 → key, 곡 중 전조(key up/down) | [audio-to-key/](audio-to-key/) |
| 2 | Audio → BPM | 곡 오디오 → BPM, 박자, 템포 변화 | [audio-to-bpm/](audio-to-bpm/) |
| 3 | Audio + Sheet → Arrangement form | 곡 오디오 + 악보 → 구간 순서 (Intro > Verse 1 > Chorus …) | [audio-sheet-to-arrangement-form/](audio-sheet-to-arrangement-form/) |
| 4 | Sheet → XML | 악보 이미지 → MusicXML | [sheet-to-xml/](sheet-to-xml/) |

## 폴더 규칙
```
<기능>/
  README.md        정의 · 현재 상태 · 파일 안내
  survey*.md       조사 종합 (한국어)
  sources/         조사 원문 (Claude, Grok)
  experiments/<이름>/   실험: README(목표·절차) + LOG(기록) + scripts/ kaggle/ results/
_common/           여러 기능이 같이 쓰는 것
  datasets/audio-500/        찬양 음원 500곡 (공식 채널, 개인 연구용)
  audio-survey-overview.md   오디오 3기능(1·2·3) 공통 조사: 방법, 분석 순서, 통합 파이프라인, 결정 사항
  experiment-resources.md    로컬·Kaggle·캐시 자원 목록
  experiments/audio-analysis-test/   key·BPM·송폼을 한 커널로 같이 잰 첫 실험 (기능 1·2·3 공통)
```

- 연산은 전부 Kaggle에서 한다. 로컬에서는 편집, 문법 확인, CLI만 한다.
- 음원, 악보, 가사는 저작물이므로 git에서 제외한다 (각 실험의 `.gitignore`).
