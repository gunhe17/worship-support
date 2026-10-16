---
paths:
  - "**/*"
---

# 구조 컨벤션

파일·폴더의 위치와 이름 규칙.

## 모노레포 구조

한 저장소에 모든 코드를 둔다. 인터페이스는 `worship_support/` 아래 폴더 1개씩.

### 인터페이스 — `worship_support/` 아래

| 폴더 | 뜻 |
|---|---|
| `api/` | application programming interface |
| `cli/` | command line interface |
| `uwi/` | user web interface |
| `awi/` | admin web interface |
| `uni/` | user native interface |
| `ani/` | admin native interface |

### 루트

| 폴더 | 뜻 |
|---|---|
| `worship_support/` | 인터페이스 코드 |
| `laboratory/` | 실험. 배포하지 않는다 |
| `.docker/` | Dockerfile, compose (`develop`·`production`) |
| `.devcontainer/` | devcontainer 설정 |
| `.env/` | env 파일. `*.example`만 커밋 |
| `script/` | `develop/`·`production/` 실행 스크립트 |

```
worship-support/
├── worship_support/
│   ├── api/
│   ├── cli/
│   ├── uwi/
│   ├── awi/
│   ├── uni/
│   └── ani/
├── laboratory/
├── .docker/
├── .devcontainer/
├── .env/
└── script/
```

### 규칙

- 새 코드는 인터페이스 폴더 중 하나에 둔다. 루트에 위 표 밖의 폴더를 만들지 않는다(`.claude/`·`.vscode/` 제외).
- 인터페이스 폴더명은 머리글자 약어, 소문자 3글자. 풀어 쓰지 않는다.
- 루트 폴더명은 약어가 아닌 단어로 짓는다.
- 폴더 전용 규칙은 `.claude/rules/<폴더>/`에 둔다.

```
# bad → good
web-admin/, admin_web/      →  awi/
mobile/, app/               →  uni/
lab/, exp/                  →  laboratory/
```
