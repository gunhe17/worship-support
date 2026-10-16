---
paths:
  - "**/*.py"
---

# 공통 코드 컨벤션

이 프로젝트 전 Python 코드 공통 스타일 — `lab/`의 실험 스크립트(`to-*/`), Kaggle 러너(`kaggle*/`), 리포트 빌더(`_reports/`). 이 문서는 시각/포맷 규칙만 담는다.

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **파일 구조** | docstring 없음. 절차 순서 = 읽기 순서(호출자 위), 모듈 상수 블록 피함 |
| **섹션 마커** | `# #` 시그니처로 논리 영역, 인라인 `# label`로 메서드 단계 |
| **네이밍** | 폴더/파일 컨텍스트 중복 금지, 준말 금지(`id`만 예외) |
| **반환값** | happy path는 named variable, 자명한 표현식은 inline(괄호 펼침) |
| **호출 스타일** | 인자 all-or-nothing, `*` 키워드 전용, nested call·삼항식 인자·메서드 체인 펼침 |
| **Import** | 표준→서드파티→로컬, 로컬은 `sys.path`에 올린 sibling 모듈 |
| **포맷팅** | 4칸, 함수 사이 2줄, flat dict 삼항식은 괄호+줄바꿈 |
| **주석 언어** | 라벨/마커 영어, 라벨 뒤 한국어 부연은 why/계약/주의만(what 재서술 금지) |

---

## 파일 구조

**모듈 docstring 작성하지 않는다.** 파일명, `# #` 섹션, 최상위 함수가 의도를 드러낸다.

**절차 순서 = 읽기 순서.** 호출자가 위, 피호출자가 아래. 최상위 함수가 파일 맨 위. 타입(`@dataclass` 등)은 그 단계 섹션 안에 동거. 전방 참조용 `from __future__ import annotations` 사용.

모듈 수준 상수 블록(`MAX_X = ...`)은 피한다. 단일 파일 스크립트(Kaggle 러너 등)라 분리할 곳이 없으면 `# config` 섹션 하나에 모은다.

```python
from __future__ import annotations

import argparse
import asyncio


# #
# orchestrate

async def generate(*, ...) -> list[ScoredSong]:
    # fetch
    metadatas = await fetch_all_metadata(...)
    # score
    scored = [score(...) for m in metadatas]
    # select
    generated = select(scored=scored, size=size)

    return generated


# #
# fetch
# (SongMetadata 타입, fetch 관련 함수들)

# #
# score
# (ScoredSong 타입, score 관련 함수들)

# #
# select
# (select 관련 함수들)
```

---

## 섹션 마커

`# #` 시그니처로 파일/클래스 내부 논리 영역 구분.

```python
# #
# factory

@classmethod
def new(cls, ...): ...
```

라벨 예:
- 모듈: `# config`, `# run`, `# cli`, `# orchestrate`, `# load`, `# infer`, `# score`, `# summarize`, `# render`
- 클래스 내부: `# factory`, `# query`, `# command`

인라인 라벨(`# label`, 단일 `#`) 로 메서드 내부 단계 표기.

```python
# type
if not isinstance(value, str):
    raise  # InvalidError

# format
if not re.match(...):
    raise  # InvalidFormatError
```

라벨 예: `# type`, `# format`, `# value`, `# length`, `# hint`, `# cap`, `# normalize`, `# components`, `# weighted sum`, `# fan-out`, `# filter`, `# backoff retry`, `# rank`, `# fallback`.

---

## 네이밍

식별자에 폴더/파일 컨텍스트를 중복하지 않는다. 호출부 `from foo.bar import X`에서 경로 `foo.bar`가 이미 컨텍스트를 제공함. `X` 안에 `foo`나 `bar`를 다시 담으면 import 라인이 `bar의 BarX`처럼 stutter.

준말(축약) 금지 — 단 `id`는 예외. 식별자는 풀어 쓴다(`config`, `bpm`, `sr`처럼 도메인 통용어 제외).

```
# bad → good
iv, tpl, kidx                   →  intervals, template, key_index
```

폴더 컨텍스트 중복 금지:

```
to-bpm/_tempo/score.py
  def score_tempo()             →  def score()
```

파일 컨텍스트 중복 금지:

```
_reports/build_bpm_song.py
  def build_bpm_song()          →  def build()

to-key/example.py
  def detect_key_librosa()      →  def detect_librosa()
```

예외 — 파일 안에 동종 다중 식별자가 있어 분별 단어가 필요한 경우:

```
to-key/example.py
  def key_essentia(), def key_librosa()          # 엔진명이 분별 단어
```

| 대상 | 형태 | 예 |
|------|------|-----|
| 클래스 | PascalCase | `Handler` |
| 함수/메서드/변수 | snake_case | `global_key`, `run_item` |
| 비공개 (모듈/필드) | `_` 접두 | `_cache`, `_load_audio` |
| `# config` 상수 | UPPER_CASE | `TOL`, `WIDE` |

---

## 반환값

**Happy path는 named variable에 담은 뒤 return.** 함수의 정상 출력을 함수 이름을 만족하는 변수에 담고 반환.

```python
metadata = SongMetadata(...)
return metadata
```

예외 — inline return:
- 가드/에러 early return: inline (`return None`, `return 0.0` 등)
- 순수 위임(passthrough): `return await delegate(...)` inline 허용 (CLI 진입점 등)
- 자명한 출력 표현식: 최종 반환이 그 자체로 자명한 단일 표현식(comprehension, dict/list literal 등)이면 변수에 담지 말고 바로 반환. 변수명이 표현식을 단순 재진술할 뿐이면(`listed = [...]; return listed`) noise. 단 여는 괄호는 `return` 줄에 두고 본문은 줄바꿈해 펼친다(한 줄에 욱여넣지 않음 — 호출 인자 펼침 규칙과 동일 결).

```python
# bad: 이름이 표현식 재진술 — noise
listed = [round(b, 2) for b in beats]
return listed

# bad: 한 줄에 욱여넣기
return [round(b, 2) for b in beats]

# good: 변수 없이 바로 반환 + 괄호 펼침
return [
    round(b, 2) for b in beats
]
```

| 함수 | 변수명 |
|------|--------|
| `fetch_all_metadata` | `metadatas` |
| `_fetch_metadata` | `metadata` |
| `score` | `scored` |
| `select` | `selected` |
| `generate` | `generated` |

규칙: 이름은 표현식이 못 주는 의미를 줄 때만 단다 — 생산 함수 출력에 의미 부여(`metadatas`)나 다단계 흐름의 중간값일 때 named variable, 표현식이 곧 의도면(자명한 변환·literal·passthrough) inline. intermediate 변수는 생산 함수 출력 의미, 최종 return 변수는 enclosing 함수 출력 의미.

---

## 호출 스타일

**인자 표기는 all-or-nothing.** 한 호출 안에서 keyword/positional 혼용 금지.

```python
# good: 전부 positional
random.sample(songs, 20)
np.percentile(errors, 95)

# good: 전부 keyword
tempo(beats=beats, downs=downs)

# bad: 혼용
librosa.load(path, sr=22050)
```

stdlib 강제 혼용 예외: `sorted(iterable, /, *, key, reverse)`, `argparse.add_argument(*name_or_flags, **kwargs)`.

키워드 전용 강제. 도메인 함수는 `*` 로 모든 인자 키워드 전용화. 다인자 시그니처는 파라미터마다 줄바꿈 + trailing comma.

```python
def analyze(
    *,
    audio: np.ndarray,
    sample_rate: int,
    window_seconds: float,
    hop_seconds: float,
) -> list[dict]:
```

인자 값이 nested call이면 호출을 펼친다. 인자 값이 그 자체로 변환/로드 호출(`sorted(...)`, `np.load(...)` 등)이면 한 줄에 욱여넣지 말고 인자마다 줄바꿈 + trailing comma.

```python
# good: nested call 인자 → 펼침
result = tempo(
    beats=sorted(beats),
    downs=np.load(downs_path),
)

# bad: 한 줄에 욱여넣기 — nested 변환이 묻힌다
result = tempo(beats=sorted(beats), downs=np.load(downs_path))
```

- 트리거는 인자 값에 nested call이 있는지 — 전부 단순 값(`beats=beats`)이면 한 줄 유지 OK
- 펼친 형태는 정의부와 동일하게 trailing comma 유지

인자 값이 삼항식(`... if ... else ...`)이면 괄호로 감싸 줄바꿈. 한 줄 삼항식은 분기가 인자 사이에 묻힌다. 괄호 + 줄바꿈으로 "이 인자는 분기가 있다(예외적 경우)"를 시각적으로 분리한다 — flat dict 값의 삼항식 규칙([포맷팅](#포맷팅) "삼항식은 괄호로 감싸 줄바꿈")과 동일 원칙, 호출 인자에도 적용.

```python
# good: 삼항식 인자 → 괄호 + 줄바꿈
result = tempo(
    beats=beats,
    downs=(
        downs if len(downs) >= 3 else ()
    ),
)

# bad: 한 줄에 삼항식 — 분기가 묻힌다
downs=downs if len(downs) >= 3 else (),
```

- 단순 값(`beats=beats`)은 한 줄 유지 — 삼항 분기가 있을 때만 적용
- 닫는 괄호 `)` 다음 trailing comma 유지

메서드 체인은 세로로 펼친다. 메서드/속성이 여러 단계 이어지는 fluent 체인을 인자/반환에 인라인하면 한 줄에 두지 말고 리딩 닷(`.`) 세그먼트마다 줄바꿈. 체인 head의 호출 인자도 펼친다(위 nested call 규칙과 동일 결). single-use 중간 변수(`path = ...`)는 두지 않는다 — 표현식을 그대로 인라인.

```python
# good: 체인 세로 펼침 — 리딩 닷 세그먼트마다 한 줄
return json.loads(
    Path(
        __file__
    )
    .resolve()
    .parent.parent
    .joinpath("_reports", "bpm-songs.json")
    .read_text()
)

# bad: 한 줄 체인 — 단계가 묻힌다
return json.loads(Path(__file__).resolve().parent.parent.joinpath("_reports", "bpm-songs.json").read_text())

# bad: single-use 중간 변수
path = Path(__file__).resolve().parent.parent.joinpath("_reports", "bpm-songs.json")
return json.loads(path.read_text())
```

- 세그먼트 = 리딩 닷으로 시작하는 한 단계. `.parent.parent / "a" / "b"`처럼 속성 접근 + 경로 결합(`/`)은 한 세그먼트로 묶어 같은 줄(예시대로)
- 단발 호출(`path.read_text()`, `np.load(...)`)은 체인이 아님 — 여러 단계가 이어질 때만 적용

---

## Import

순서: 표준 → 서드파티 → 로컬. 그룹마다 한 줄 공백. `lab/`은 패키지가 아니므로 로컬은 sibling 모듈 디렉터리를 `sys.path`에 올린 뒤 모듈명으로 import한다(`# noqa: E402`).

```python
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "_tempo"))
from tempo import tempo  # noqa: E402
```

Kaggle 러너는 Kaggle 경로(`/kaggle/working/...`)를 `sys.path`에 올린다 — 로컬 상대경로는 Kaggle에서 깨진다.

---

## 포맷팅

- 들여쓰기 4칸
- import 블록 후 두 줄 공백
- 모듈 함수 사이 두 줄 공백 (`# cli` 섹션 내부는 한 줄 예외)
- 메서드 사이 한 줄 공백
- 긴 함수 시그니처: 파라미터마다 줄바꿈 + trailing comma
- `if __name__ == "__main__":` 는 파일 하단 `# cli` 또는 `# run` 섹션

flat dict return의 삼항식은 괄호로 감싸 줄바꿈. 결과 레코드처럼 한 줄 = 한 키인 딕셔너리에서, 값에 `... if ... else ...`가 들어가면 키 라인이 길어진다. 괄호 + 줄바꿈으로 "이 키는 분기가 있다"를 시각적으로 분리.

```python
# bad: 한 줄에 삼항식
return {
    "bpm": round(bpm, 1) if bpm else None,
}

# good: 괄호 + 줄바꿈
return {
    "bpm": (
        round(bpm, 1) if bpm else None
    ),
}
```

- 단순 값(`"method": method`)은 한 줄 유지 — 분기 문법이 있을 때만 적용
- 닫는 괄호 `)` 다음 trailing comma 유지

---

## 주석 언어

- 코드 라벨/섹션 마커: 영어 (`# factory`, `# query`)

### 라벨 뒤 부연 — 라벨만 기본, 형태부터 금지

인라인 라벨은 영어 한 단어(`# find`, `# event`). 부연은 코드가 드러내지 못하는 것 — 비자명한 의도(why)·입력 계약·주의(gotcha) — 일 때만, 그리고 `# label (…)`/`# label — …` 형태가 **아니라** plain 한 줄(메서드 단계) 또는 트레일링 인라인(선언)으로. 코드가 이미 보여주는 동작(what)을 재서술하지 않는다.

> **기본은 라벨만 — 부연을 적으려는 손을 멈춰라.** 대부분은 코드·시그니처·타입·docs가 이미 말하는 재서술이다. "어디에도 없는 why/계약/함정인가?"에 확실히 yes일 때만, 그때도 라벨 부연이 아니라 plain 줄/트레일링으로.

[check_label_comments.py](../../hooks/check_label_comments.py) 훅이 세 형태를 기계적으로 잡는다 — `# label (괄호)`, `# label — em-dash`, 선언(`name: type`) 바로 위 산문 주석. 살아남는 부연은 그 형태를 피해야 한다.

- **메서드 단계 why/계약**: `# label (frag)`가 아니라 **plain 한 줄**로(`# 박 시각이 20ms 격자라 중앙값 대신 평균`). 라벨은 라벨대로(`# score`).
- **선언(field/var) 계약**: 별도 줄이 아니라 **트레일링 인라인**(`EDGE = 0.05  # 초`). 이름·타입이 의미를 지면 **무주석**.
- 냄새 신호 (가장 흔함): `# label (호출이 하는 일 요약)` — 라이브러리 호출·함수가 *이미 하는 일*을 푼 것. 시그니처가 말하므로 라벨만. "파이프라인 단계 설명"은 거의 다 이 부류.
- 냄새 신호: `# label (… 없음/안 함/미전달)` — 부재·생략은 호출부에 이미 보인다. *왜* 부재인지가 어디에도 없을 때만, plain 줄로.
- 설계 근거는 docs(`feature.md`·실험 README)에, 코드 주석에 복제하지 않는다.
- 필드/변수 선언 주석은 기본 금지 — 타입이 말하는 것(`int | None`) 재서술이거나 docs 근거 복제다. 진짜 함정만 트레일링 인라인.

```python
# good: 라벨만 — 단계는 라벨이 목차
# load
# infer
# score

# bad: 괄호·em-dash 부연(what 재서술) → 라벨만 (훅이 잡음)
# infer (Beat This! 로 박·첫 박 추출)                     →   # infer
# score (GT 와 ±4% 안이면 정답)                           →   # score
# load (16kHz 모노 — 리샘플)                              →   # load

# good: 살아남는 why = 라벨 부연이 아니라 plain 한 줄(코드에 안 보이는 함정)
# ±4%로 자르면 20ms 격자 한 칸이 경계에 걸려 치우친다

# bad: 선언 위 산문 / 이름 의미 복제 → 무주석
# beats = 박 시각 목록
beats: list[float]                                       →   beats: list[float]
```
