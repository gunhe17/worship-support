# Auth MVP 구현 리뷰

## 구현 범위

| 엔드포인트 | 기능 |
|---|---|
| `POST /auth/signup` | 회원가입 |
| `POST /auth/login` | 로그인 |
| `POST /auth/refresh` | 토큰 갱신 |
| `POST /auth/logout` | 로그아웃 |
| `GET /users/me` | 현재 사용자 조회 |

---

## 아키텍처

Spring MVC의 Controller → Service → Repository 구조와 대응되는 FastAPI DDD 레이어를 사용했다.

```
[HTTP 요청]
    ↓
Endpoint         ← FastAPI 핸들러. Spring의 Controller에 해당
    ↓
UseCase          ← 비즈니스 흐름 조율. Spring의 Service에 해당
    ↓
Domain           ← 핵심 비즈니스 규칙 (User, Email, RawPassword 등)
    ↓
Repository       ← DB 접근. Spring의 Repository에 해당
    ↓
Unit of Work     ← 트랜잭션 경계. Spring의 @Transactional에 해당
```

도메인 모델은 `frozen dataclass`로 정의해 불변성을 보장했다.

---

## 인증 흐름 요약

### 로그인

1. 이메일로 사용자 조회
2. 계정 상태 확인 (`active` 아닐 경우 거부)
3. bcrypt로 비밀번호 검증
4. JWT access token 발급 (유효기간 15초/운영 900초)
5. opaque refresh token 생성 → SHA-256 해시만 DB 저장
6. 두 토큰 모두 HttpOnly cookie로 전달

### 토큰 갱신

- refresh token rotation: 기존 토큰 revoke → 새 토큰 발급
- 재사용 감지: 이미 revoke된 토큰 재사용 시 `REFRESH_TOKEN_REUSED` 반환
- CSRF 검증 필수 (`X-CSRF-Token` 헤더)

### 로그아웃

- refresh token revoke
- 쿠키 삭제
- 쿠키 없이 호출 시 정상 응답 (idempotent)

---

## 보안 설계

### 쿠키 구성

| 쿠키 | HttpOnly | Path | 만료 |
|---|---|---|---|
| `access_token` | ✅ | `/` | 15초 |
| `refresh_token` | ✅ | `/auth` | 7일 |
| `csrf_token` | ❌ (JS 읽기 허용) | `/` | 7일 |

`refresh_token`의 path를 `/auth`로 제한해 불필요한 전송 범위를 줄였다.

### CSRF 보호

refresh/logout에 double-submit cookie 방식 적용:
- `csrf_token` cookie 값과 `X-CSRF-Token` 헤더 값을 `secrets.compare_digest`로 비교

### 비밀번호

- bcrypt 해시만 저장
- 평문 비밀번호는 어디에도 기록하지 않음
- 8자 이상, 72바이트 이하 제한 (bcrypt 한계)

### Audit Log

signup/login/refresh/logout 성공·실패를 모두 기록한다.
개인정보(이메일, IP, User-Agent)는 원문 대신 HMAC-SHA256 해시로 저장한다.

---

## 에러 설계

모든 에러는 동일한 구조로 반환한다.

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

이메일 존재 여부를 노출하지 않기 위해 이메일 미존재와 비밀번호 불일치 모두 `INVALID_CREDENTIALS`로 통일했다.

---

## 테스트

- 실제 PostgreSQL에 대한 통합 테스트 (DB mocking 없음)
- 테스트마다 테이블 truncate로 격리
- 주요 케이스: signup, login, token rotation, reuse attack, CSRF, logout

---

## MVP 이후 과제

- Rate limiting (brute force 방어)
- 초대 코드 또는 가입 승인 흐름
- 비밀번호 재설정
- 운영 환경 `JWT_SECRET_KEY` 교체 및 HTTPS 적용
