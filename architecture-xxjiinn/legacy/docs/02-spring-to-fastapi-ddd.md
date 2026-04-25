# Spring MVC에서 FastAPI DDD로

이 문서는 Spring Boot MVC에 익숙한 개발자가 이번 튜토리얼의 FastAPI + DDD 구조를 이해하기 위한 비교 문서다.

## 큰 개념 매핑

| Spring Boot MVC | 이번 튜토리얼의 FastAPI + DDD |
|---|---|
| Controller | endpoint/router |
| Request DTO | Pydantic request schema |
| Response DTO | Pydantic response schema |
| Service | application usecase |
| Entity | domain entity 또는 ORM model |
| Value Object | domain value object |
| Repository interface | repository port |
| Repository implementation | SQLAlchemy repository adapter |
| EntityManager / Transactional | SQLAlchemy AsyncSession + Unit of Work |
| `@ControllerAdvice` | FastAPI exception handler |
| `application.yml` | Pydantic Settings + 환경변수 |

## 큰 흐름 차이

일반적인 Spring MVC 프로젝트에서는 아래 흐름을 자주 사용한다.

```text
Controller -> Service -> Repository -> DB
```

이번 튜토리얼의 목표 흐름은 아래와 같다.

```text
endpoint -> usecase -> domain/repository port -> repository adapter -> database
                         |
                         v
                    unit of work
```

## 왜 Usecase를 명확히 두는가?

Usecase layer는 애플리케이션 흐름을 명시적으로 드러내기 위해 존재한다.

예를 들어 signup은 단순히 "user 저장"이 아니다.

1. signup input을 받는다.
2. email과 password를 검증한다.
3. email 중복을 확인한다.
4. password를 hash한다.
5. user를 생성한다.
6. user를 저장한다.
7. transaction을 commit한다.
8. response data를 반환한다.

이 흐름을 endpoint에 직접 넣으면 HTTP 코드와 비즈니스 흐름이 섞인다.
반대로 너무 큰 service에 숨기면 service의 책임이 불명확해진다.

Usecase layer는 HTTP, DB, 보안 라이브러리 세부사항을 경계 뒤에 두면서 비즈니스 흐름을 보이게 만든다.

## 왜 Repository가 commit/rollback을 하지 않는가?

Repository는 데이터 접근을 담당한다.
트랜잭션 경계를 결정하는 책임은 갖지 않는다.

각 repository method가 직접 commit하면 여러 DB 작업이 하나의 usecase 안에서 함께 성공하거나 함께 실패해야 하는 경우를 보장하기 어렵다.

예를 들어 refresh token을 나중에 추가하면 login은 아래 작업을 함께 처리할 수 있다.

1. user 검증
2. refresh token row 생성
3. audit log 기록
4. commit

이 작업들은 함께 성공하거나 함께 실패해야 한다.
그래서 트랜잭션 제어는 개별 repository가 아니라 usecase 또는 Unit of Work 경계에 둔다.

## 왜 Domain 객체가 FastAPI, SQLAlchemy, JWT를 몰라야 하는가?

Domain 객체는 비즈니스 규칙을 표현해야 한다.

예:

- `Email`은 값이 유효한 email인지 안다.
- `User`는 status 기준으로 login 가능한지 안다.
- `PasswordHash`는 저장된 비밀번호 hash를 표현한다.

Domain 객체가 알면 안 되는 것:

- HTTP request/response
- FastAPI dependency
- SQLAlchemy session
- PostgreSQL table
- JWT payload format
- bcrypt library call

이유:

1. web server나 database 없이 domain 규칙을 테스트하기 쉬워진다.
2. FastAPI나 SQLAlchemy 세부사항이 바뀌어도 domain 코드를 덜 바꾼다.
3. 보안/영속성 세부사항은 application 또는 infrastructure layer에 머문다.
4. 코드가 프레임워크 언어보다 프로젝트의 비즈니스 언어에 가까워진다.

요약하면 아래와 같다.

```text
Domain은 비즈니스 의미를 안다.
Infrastructure는 기술 세부사항을 안다.
Usecase는 둘을 연결한다.
```

## 이번 튜토리얼 기준

이번 튜토리얼은 FastAPI 기반 v1 아키텍처 문서를 따른다.

Supabase/Next.js/RLS 기반 문서는 따르지 않는다.

