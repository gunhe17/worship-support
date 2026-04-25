# Auth 도메인 모델

이 문서는 auth 관련 도메인 모델을 정리한다.

## 후보 개념

- User
- Email
- RawPassword
- PasswordHash
- UserStatus
- AccessToken
- RefreshToken

## UserStatus

`UserStatus`는 계정 사용 가능 상태를 표현한다.

허용 값:

- `active`
- `blocked`
- `deactivated`

`active`는 현재 접속 중이라는 뜻이 아니다.
서비스 이용과 login이 허용된 계정 상태라는 뜻이다.

`blocked` 또는 `deactivated` 사용자는 password가 맞아도 login할 수 없다.

## 비밀번호 관련 모델링 방향

### RawPassword

사용자가 signup 또는 login 요청에서 입력한 비밀번호를 의미한다.

책임:

- 문자열 타입인지 확인
- 최소 길이 8자 확인
- UTF-8 기준 최대 길이 72 bytes 확인

알면 안 되는 것:

- bcrypt 구현
- DB 저장 방식
- FastAPI request

### PasswordHash

DB에 저장되는 password hash 값을 의미한다.

책임:

- 저장 가능한 hash 문자열을 표현

알면 안 되는 것:

- raw password
- HTTP 요청
- SQLAlchemy session

### PasswordHasher

bcrypt를 사용해 raw password를 hash하거나, raw password와 password hash를 비교한다.

이 객체는 순수 domain object라기보다 보안 기술을 다루는 service다.
따라서 `app/core/security.py` 또는 infrastructure 성격의 위치에 둔다.

## 아직 정하지 않은 것

- `User`를 auth domain에 둘지, user domain에 둘지, 또는 양쪽에서 공유하는 개념으로 볼지
- password hashing을 domain service, infrastructure service, application service 중 어디에 둘지
- refresh token을 User aggregate 안에 둘지 별도 aggregate로 둘지

## Domain Entity와 ORM Model 분리

이번 튜토리얼에서는 domain entity와 SQLAlchemy ORM model을 분리한다.

Domain:

```text
User
Email
RawPassword
PasswordHash
UserStatus
```

ORM:

```text
UserModel
RefreshTokenModel
```

Repository:

```text
Domain object <-> ORM model 변환
```

이 구조는 코드가 조금 늘어나지만, DDD 학습과 레이어 경계 이해에 더 적합하다.
