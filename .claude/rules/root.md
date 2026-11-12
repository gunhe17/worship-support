---
paths:
  - "tests/**"
  - "**/tests/**"
  - "**/test_*.py"
  - "pyproject.toml"
  - ".vscode/**"
  - "**/documents/**"
---

# repo 루트 배치

루트에 무엇을 두고, 무엇을 앱 내부로 내리고, 무엇을 에디터에서 감추는지.

## documents — 전부 .claude 아래

문서는 `.claude/documents/`에 둔다. 앱 전용은 `.claude/documents/{app}/`. `@`-import 조각과 그 근거 원문(`anthropic/` 등) 모두 — 자동 로드가 없어 컨텍스트 비용 0. 루트 `documents/`는 두지 않는다 — Claude와 무관한 사람용 제품 문서가 실제로 생길 때만 부활.

## tests — 각 앱 내부에

테스트는 검증 대상 앱(`worship_support/api`·`mcp`·`cli` …) 내부에 둔다 — colocate `test_*.py` 또는 앱 내 `tests/`. 루트 `tests/`에 새 테스트를 만들지 않는다. 테스트 헬퍼(factory 등)도 쓰는 앱 안으로.

```
# good: worship_support/api/infrastructure/map/test_map.py
# bad:  tests/test_map.py
```

코드 규칙(import 방향·폴더 구조·이름 규약·등록부 등)을 소스를 훑어 검사하는 것은 테스트가 아니라 hook이다 — `.claude/hooks/check_code_rules.py`에 규칙별 검사 함수를 추가한다. 테스트는 동작을 검증하고, 코드 규칙은 편집 시점에 hook이 막는다.

```
# good: .claude/hooks/check_code_rules.py 의 dialect_free()
# bad:  worship_support/api/domain/test_dialect_free.py
```

## 저독성 파일 — .vscode로 감춘다

개발자가 직접 읽을 일이 적은 설정/메타 파일(`pyproject.toml`, 캐시·`.DS_Store` 류)은 `.vscode/settings.json`의 `files.exclude`에 등록해 탐색기에서 감춘다. 도구가 읽는 파일이지 사람이 읽는 파일이 아니다 — 수정할 땐 명령/검색으로 연다. 목록의 단일 출처는 `.vscode/settings.json`.
