# Shared Project Rules

## MCP

- 의존성 조회: `mcp__worship-support-dev__show_dependency`

## 수정 워크플로우

1. `show_dependency`로 의존처 확인
    1-2. if, MCP 결과 `no usages` / `no definitions`라면 그 결과를 신뢰한다. Grep·Glob으로 재검증하지 않는다. MCP 서버 응답 불가일 때만 대체 수단 사용.
2. 대상 수정
3. 의존처 전부 반영