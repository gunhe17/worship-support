# Auth 구현에서 발견한 설계 고려사항

> 회원가입·로그인을 구현하면서, 처음에는 자연스럽게 떠오르지 않았지만
> 실제로 결정을 해야 했던 지점들을 정리한다.

---

## 1. 비밀번호 해시: 어느 레이어에서 해야 하나?

회원가입에서 비밀번호를 받으면, DB에 저장하기 전에 반드시 bcrypt로 해시해야 한다.
문제는 **그 해시를 어디서 할 것인가**다.

```
도메인(User 엔티티)에서?
  → 도메인이 bcrypt라는 외부 라이브러리에 의존하게 됨
  → bcrypt를 다른 라이브러리로 교체하면 도메인 코드도 바꿔야 함

Repository에서?
  → Repository는 저장만 담당해야 함 (저장 + 해시 = 역할 두 개)
  → 로그인 시 비밀번호 검증도 필요한데, 검증도 Repository를 통해서 하면 어색함
```

### 결정

> UseCase가 PasswordHasher(서비스)를 주입받아 해시한 뒤, 결과값만 도메인에 넘긴다.

<small>코드 위치: `backend/app/domains/user/domain.py` — `RawPassword`, `PasswordHash` · `backend/app/core/security.py` — `PasswordHasher` · `backend/app/domains/auth/usecase.py` — `SignupUseCase.execute()`</small>

```
UseCase → PasswordHasher.hash(원문)  ← 인프라 서비스 (bcrypt 사용)
       → PasswordHash(해시값)        ← 도메인 Value Object에 전달
       → User 엔티티 생성
       → Repository.add(user)        ← 저장만 담당
```

- `RawPassword`: 원문 비밀번호를 담는 Value Object. 길이 검증만 함.
- `PasswordHash`: 해시된 값을 담는 Value Object. 내부 구조는 모름.
- `PasswordHasher`: UseCase에 주입되는 서비스. bcrypt 사용.

도메인은 "이 값이 해시된 비밀번호다"라는 사실만 안다. bcrypt인지 argon2인지는 모른다.

---

## 2. bcrypt의 숨겨진 제한: 72바이트 초과는 조용히 잘린다

bcrypt는 입력을 **72바이트**까지만 처리하고, 초과분을 아무 에러 없이 잘라버린다.

```
"가나다라마바사아자차카타파하가나다라마바사아자차카" (25글자)
  → 바이트로 환산하면 75바이트 (한글 1글자 = UTF-8 기준 3바이트)
  → bcrypt는 72바이트까지만 읽고 나머지 3바이트는 무시
  → "가나다라마바사아자차카타파하가나다라마바사아자차카" 와
     "가나다라마바사아자차카타파하가나다라마바사아자차카" + 어떤 글자든
     동일한 비밀번호가 되어버림
```

### 결정

> Value Object 생성 시점에, 글자 수와 바이트 수를 각각 검증한다.

<small>코드 위치: `backend/app/domains/user/domain.py` — `RawPassword.__post_init__`</small>

```python
if len(password) < 8:                    # 글자 수 기준: 최소 8자
    raise ValidationError()
if len(password.encode("utf-8")) > 72:   # 바이트 수 기준: bcrypt 한계
    raise ValidationError()
```

`len(str)`은 글자 수, `len(str.encode("utf-8"))`는 바이트 수다. 한글처럼 한 글자가 여러 바이트인 언어에서는 둘이 다르다. bcrypt의 제한은 바이트 기준이므로 바이트 수를 명시적으로 검사해야 한다.

---

## 3. 로그인 검증 순서: 두 줄의 순서가 보안에 영향을 준다

로그인 시 두 가지를 확인한다.
- 비밀번호가 맞는가
- 계정이 활성 상태인가

이 두 확인의 순서에 따라 다른 결과가 나온다.

```
# 비밀번호를 먼저 검증하면

차단된 계정 + 맞는 비밀번호  →  USER_NOT_ACTIVE
차단된 계정 + 틀린 비밀번호  →  INVALID_CREDENTIALS
```

응답 코드가 달라지므로, 공격자는 "차단 계정의 비밀번호를 맞혔는지"를 응답으로 알 수 있다.
또한 bcrypt 검증은 느린 연산인데, 어차피 거부될 계정에 대해 불필요하게 실행된다.

### 결정

> 계정 상태를 먼저 확인하고, 통과한 경우에만 비밀번호를 검증한다.

<small>코드 위치: `backend/app/domains/auth/usecase.py` — `LoginUseCase.execute()` · `backend/app/domains/user/domain.py` — `User.ensure_can_login()`</small>

```
차단된 계정 + 맞는 비밀번호  →  USER_NOT_ACTIVE
차단된 계정 + 틀린 비밀번호  →  USER_NOT_ACTIVE  (동일)
```

차단 계정은 비밀번호 정답 여부와 무관하게 항상 같은 응답을 받는다.

**왜 이 규칙을 User 엔티티 메서드로 두는가?**

로그인 가능 여부는 로그인(LoginUseCase)뿐만 아니라 토큰 갱신(RefreshUseCase)에서도 확인해야 한다. UseCase마다 같은 조건문을 반복하면, 나중에 조건이 바뀔 때 모든 UseCase를 찾아서 수정해야 한다.

```python
# User 엔티티
def ensure_can_login(self) -> None:
    if self.status is not UserStatus.ACTIVE:
        raise AppError(ErrorCode.USER_NOT_ACTIVE)

# LoginUseCase, RefreshUseCase 모두
user.ensure_can_login()  # 규칙은 한 곳에만 있음
```

---

## 4. Refresh Token: 세 가지가 하나의 세트다

refresh token을 안전하게 만들려면 세 가지가 함께 필요하다. 하나라도 빠지면 나머지가 의미를 잃는다.

<small>코드 위치: `backend/app/core/security.py` — `RefreshTokenService` · `backend/app/domains/auth/usecase.py` — `RefreshUseCase.execute()`</small>

**① 원문이 아닌 해시만 저장**

refresh token 원문을 DB에 그대로 저장하면, DB가 유출됐을 때 공격자가 모든 사용자의 세션을 탈취할 수 있다.

```
클라이언트에게 보내는 것 : 원문 토큰
DB에 저장하는 것        : SHA-256(원문 토큰)
검증할 때              : SHA-256(받은 토큰) == DB 값 비교
```

원문은 클라이언트 쿠키에만 존재하고, 서버는 해시만 갖는다. DB가 유출되어도 원문을 알 수 없다.

**② Rotation (갱신마다 교체)**

refresh 요청이 올 때마다, 기존 토큰을 폐기하고 새 토큰을 발급한다. 하나의 토큰은 딱 한 번만 사용할 수 있다.

교체하지 않으면, 한 번 탈취된 토큰이 만료될 때까지 무기한 사용된다.

**③ Reuse Detection (재사용 탐지)**

이미 폐기된 토큰이 다시 들어오면, 이것은 "토큰이 탈취되어 공격자가 사용하고 있다"는 신호다.

```
폐기된 토큰으로 갱신 요청
  → REFRESH_TOKEN_REUSED 에러
  → (더 강한 대응이 필요하면) 해당 사용자의 모든 세션을 강제 종료
```

---

## 5. HttpOnly Cookie와 CSRF: 두 공격을 동시에 막으려면 조합이 필요하다

**왜 HttpOnly Cookie를 쓰는가?**

access token을 JavaScript로 읽을 수 있는 곳(localStorage, 일반 쿠키)에 저장하면, XSS(사이트에 악성 스크립트 삽입) 공격으로 토큰을 훔칠 수 있다. HttpOnly 쿠키는 JavaScript에서 읽지 못하므로 XSS를 막는다.

**HttpOnly만으로는 충분하지 않은 이유**

브라우저는 쿠키를 자동으로 전송한다. 공격자가 사용자 대신 요청을 보내도(CSRF), 브라우저가 쿠키를 자동으로 실어 보내기 때문에 서버는 정상 요청과 구별하기 어렵다.

**해결: CSRF 토큰 추가**

<small>코드 위치: `backend/app/domains/auth/cookies.py` — `set_auth_cookies()`</small>

```
access_token  → HttpOnly 쿠키  (JavaScript 읽기 불가 → XSS 방어)
refresh_token → HttpOnly 쿠키  (JavaScript 읽기 불가 → XSS 방어)
csrf_token    → 일반 쿠키     (JavaScript 읽기 가능 → 헤더에 담아 전송)
```

서버는 `csrf_token` 쿠키 값과 `X-CSRF-Token` 헤더 값이 같은지 확인한다. 브라우저는 임의의 헤더를 자동으로 추가하지 않으므로, 공격자가 CSRF를 시도해도 헤더를 일치시킬 수 없다.

공격자가 XSS로 `csrf_token`을 탈취하더라도, `access_token`은 HttpOnly라 읽지 못하므로 세션 자체를 탈취하기는 어렵다.

**Cookie Path 제한**

```
access_token  path=/      → 모든 요청에 쿠키 포함
refresh_token path=/auth  → /auth/* 요청에만 쿠키 포함
```

refresh_token은 갱신·로그아웃 요청 외에는 필요하지 않으므로, 전송 범위를 /auth로 제한한다.

---

## 6. Audit Log: 트랜잭션을 같이 묶을지, 분리할지

**같은 트랜잭션에 넣으면**

audit log DB 오류 → 회원가입·로그인 전체 rollback → 사용자는 성공한 작업이 실패한 것으로 보임.

**별도 트랜잭션으로 분리하면**

audit log 오류가 생겨도 회원가입·로그인은 정상 응답. 단, 서버가 갑자기 꺼지면 audit log가 누락될 수 있다.

### 결정

> audit log는 별도 세션으로 기록한다. audit log 실패가 서비스 핵심 흐름을 막아선 안 된다.

<small>코드 위치: `backend/app/core/audit.py` — `AuthAuditLogger.log()`, `_hash_optional()`</small>

**개인정보 처리**

audit log에 이메일, IP를 그대로 저장하면, 로그 파일이 개인정보가 된다.

```
저장하는 것  : HMAC-SHA256(이메일, 서버 시크릿)
저장하지 않는 것 : 이메일 원문
```

같은 이메일은 항상 같은 해시값이므로, "이 이메일이 이상 패턴을 보이는가" 같은 조회는 가능하다. 원문은 서버 시크릿 없이 복원할 수 없다.

---

## 정리

| 고려사항           | 핵심 결정                                            |
| ------------------ | ---------------------------------------------------- |
| 비밀번호 해시 위치 | UseCase → PasswordHasher → PasswordHash(도메인)      |
| bcrypt 72바이트    | Value Object에서 UTF-8 바이트 수 명시 검증           |
| 로그인 검증 순서   | 상태 확인 → 비밀번호 검증                            |
| Refresh Token      | 해시 저장 + rotation + reuse detection 세트          |
| Cookie + CSRF      | HttpOnly(XSS 방어) + csrf_token 이중 제출(CSRF 방어) |
| Audit Log          | 별도 트랜잭션 + PII HMAC 해싱                        |

이 결정들은 auth에서 처음 정하지만, 이후 도메인들이 audit log 연동, 권한 검증, 트랜잭션 경계를 설계할 때도 같은 고민이 반복된다.
