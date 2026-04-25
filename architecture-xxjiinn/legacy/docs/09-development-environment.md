# 개발 환경

이 문서는 auth 튜토리얼의 개발 환경과 실행 기반을 정리한다.

## 결정된 도구

```text
패키지 관리:
  uv

Python:
  Python 3.13

DB:
  PostgreSQL

DB 실행:
  Docker Compose

PostgreSQL image:
  postgres:16-alpine

구현 위치:
  sj-draft/backend
```

## DB 이름

```text
local database:
  worship_support_auth

test database:
  worship_support_auth_test
```

## Spring Boot와의 비교

Spring Boot에서는 보통 아래 요소가 자연스럽게 제공된다.

```text
Gradle/Maven
application.yml
Spring Boot 내장 서버
Spring Data JPA
@Transactional
```

FastAPI에서는 아래 요소를 직접 정해야 한다.

```text
uv
pyproject.toml
.env
uvicorn
Docker Compose PostgreSQL
SQLAlchemy async
Alembic
pytest
CORS 설정
```

## 왜 uv를 사용하는가?

`uv`는 Python 프로젝트의 의존성 설치, 가상환경, 실행을 빠르고 단순하게 관리할 수 있게 해준다.

이번 튜토리얼에서는 Python 패키지 관리를 학습 목표의 중심에 두지 않는다.
따라서 프로젝트 실행과 의존성 관리가 간단한 `uv`를 사용한다.

## 왜 Docker Compose로 PostgreSQL을 실행하는가?

PostgreSQL을 로컬에 직접 설치하면 각 개발자의 설치 상태에 따라 환경이 달라질 수 있다.

Docker Compose를 사용하면 아래 장점이 있다.

- 같은 PostgreSQL version을 사용한다.
- DB 시작/종료 명령이 명확하다.
- 로컬 DB와 테스트 DB를 분리하기 쉽다.
- 나중에 CI 환경과 연결하기 쉽다.

## 왜 로컬 DB와 테스트 DB를 분리하는가?

테스트는 데이터를 만들고 지우는 작업을 반복한다.

테스트 DB를 분리하지 않으면 개발 중 만든 데이터가 테스트에 의해 지워지거나, 반대로 개발 데이터 때문에 테스트가 실패할 수 있다.

따라서 아래처럼 분리한다.

```text
worship_support_auth:
  개발 실행용

worship_support_auth_test:
  테스트 실행용
```

## Step -1.3 실행 기반 검증 기록

### `.env`

로컬 실행용 `.env` 파일을 만들었다.

`.env`는 로컬 비밀값과 환경별 설정을 담는 파일이므로 `.gitignore`에 포함한다.

`.env.example`은 팀원이 어떤 환경변수를 준비해야 하는지 알 수 있게 하는 샘플 파일이다.

### `uv sync`

아래 명령으로 의존성을 설치했다.

```text
uv sync
```

결과:

```text
성공
```

`uv sync`는 Spring Boot의 Gradle/Maven dependency resolve와 비슷한 역할을 한다.

### FastAPI app 실행

아래 명령으로 FastAPI app을 실행했다.

```text
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

아래 요청으로 health check를 확인했다.

```text
curl http://127.0.0.1:8000/health
```

응답:

```json
{"status":"ok"}
```

결과:

```text
성공
```

### Python compile 검증

아래 명령으로 app package의 Python 문법을 검증했다.

```text
uv run python -m compileall app
```

결과:

```text
성공
```

### Docker Compose PostgreSQL

아래 명령으로 PostgreSQL 실행을 시도했다.

```text
docker compose up -d postgres
```

결과:

```text
성공
```

초기에는 Docker daemon이 실행 중이 아니어서 실패했다.
Docker Desktop을 실행한 뒤 다시 실행하자 정상적으로 PostgreSQL image를 pull하고 container를 시작했다.

컨테이너 상태:

```text
Up, healthy
```

DB 목록 확인:

```text
worship_support_auth
worship_support_auth_test
```

결론:

```text
로컬 DB와 테스트 DB 모두 준비됨
```

## 환경변수 추가 기록

Cookie 인증과 browser frontend 연결을 위해 CORS 설정 경계를 추가했다.

```text
CORS_ALLOWED_ORIGINS=[]
CORS_ALLOW_CREDENTIALS=true
```

현재는 frontend origin이 정해지지 않았으므로 기본값은 빈 목록이다.
빈 목록이면 FastAPI app에 CORS middleware를 등록하지 않는다.

나중에 frontend origin이 정해지면 예를 들어 아래처럼 설정한다.

```text
CORS_ALLOWED_ORIGINS=["http://localhost:3000"]
```
