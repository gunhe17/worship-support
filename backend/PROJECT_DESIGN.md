# Project Design

Status: DESIGN_LOCKED<br>
Design version: 2026-10-07 (P-01–P-06 및 후속 권한 정책 승인 반영; 구현 상태는 PROJECT.md)<br>
Project risk level: CRITICAL

## 1. Goal and Non-goals

### Goal

이 프로젝트는 장기적으로 교회의 예배 준비 업무 전반을 지원하는 협업 서비스다.

V1의 제품 범위는 **찬양 콘티 준비**로 제한한다. V1은 사용자가 Workspace 안에서 찬양 곡을 탐색·선택하고, 악보와 Reference를 연결하고, 곡별 Key/BPM/세션/메모와 SongForm을 구성하고, YouTube Playlist와 Export 결과물까지 만들 수 있어야 한다.

V1은 특정 교회의 실제 업무 흐름 전체를 강제하지 않는다. 설교자로부터 정보를 받거나 묵상하는 과정 등은 교회마다 다를 수 있으므로 필수 Workflow로 모델링하지 않는다. 대신 찬양 콘티 내부에서 필요한 핵심 작업을 안정적으로 지원한다.

### V1 포함 범위

- 이메일/비밀번호 기반 회원가입·로그인·로그아웃
- 이메일 인증, 비밀번호 변경·재설정
- Google 로그인 및 안전한 계정 연결
- 다중 UserEmail 관리
- Workspace 생성 및 조회
- 유일 ADMIN의 Workspace 종료 및 소속 종료
- 이메일 기반 Workspace 초대, 재전송, 취소, 수락
- Workspace Membership 및 ADMIN/MEMBER 역할
- Document 생성 및 접근 정책
- Document 단위 MANAGER/EDITOR/VIEWER 권한
- V1 DocumentType `SETLIST`
- Setlist 생성·조회·수정
- SetlistItem 추가·삭제·순서 변경
- 곡 검색 후보 탐색 및 Workspace Song 등록/재사용
- Score 업로드·조회·선택·Workspace 내 재사용
- Reference 직접 URL 등록 및 YouTube 검색 결과 선택
- 곡별 Key/BPM/세션/메모 관리
- 구조화된 SongForm 작성·수정
- YouTube Playlist 생성·수정
- 특정 Document/Setlist version 기준 Export 생성 및 다운로드
- 외부 공유 가능한 PDF 형식의 Export

### V1 비목표

다음은 V1에서 구현하지 않는다.

- 설교 작성/관리
- 주보 작성/관리
- 예배 당일 운영 기능
- STT 기반 현재 Song Section 추적
- Click 제어, Live/Talkback
- 커뮤니티
- 사용자 템플릿 이미지 인식 및 자동 재현
- 실시간 공동편집
- 내부 화폐/범용 요금제 시스템
- 서비스 전역 공용 Song Catalog
- Church/Organization 계층
- parent workspace 구조
- public Workspace/document link
- 범용 Template 엔진
- Redis/메시지 큐/이벤트 플랫폼
- 마이크로서비스
- CRDT/OT
- Rust LLM worker
- 특정 Agent Runtime/LLM orchestration 구현

실시간 공동편집은 V1 이후 반드시 지원할 예정이므로, V1 데이터 모델과 수정 충돌 처리 방식은 이를 방해하지 않아야 한다. 그러나 이를 이유로 V1에 CRDT/OT를 선제 도입하지 않는다.

---

## 2. Users and Core Flows

### 주요 Actor

- `User`: 서비스 전체의 사용자 계정
- `Workspace ADMIN`: Workspace 구성원 관리 권한을 가진 사용자
- `Workspace MEMBER`: 일반 Workspace 구성원
- `Document MANAGER`: 특정 Document의 조회·수정·권한 관리를 수행
- `Document EDITOR`: 특정 Document의 조회·수정 수행
- `Document VIEWER`: 특정 Document의 조회 수행
- 향후 `Agent`: 사용자의 자연어 의도를 해석하고 Backend Application Capability를 호출하는 별도 실행 주체. V1 Core Backend 구현과는 분리한다.

교회 직분, 찬양팀에서의 인도자/세션/싱어 역할은 시스템 권한과 동일시하지 않는다.

### 핵심 흐름 1 — 계정 생성과 로그인

1. 사용자가 이메일로 회원가입한다.
2. 이메일 소유권을 인증한다.
3. 비밀번호 로그인 또는 Google 로그인을 사용할 수 있다.
4. 로그인된 브라우저는 server-side Session으로 인증 상태를 유지한다.
5. Workspace/Document 권한은 Session에 고정 저장하지 않고 요청 시 DB 기준으로 다시 판단한다.

### 핵심 흐름 2 — Workspace 생성과 초대

1. 이메일 인증이 완료된 User는 Workspace를 생성할 수 있다.
2. Workspace 생성자는 ADMIN Membership을 얻는다.
3. ADMIN은 일반 이메일 주소로 사용자를 초대할 수 있다.
4. 초대 대상자는 해당 이메일의 실제 소유권을 verified UserEmail로 증명해야 한다.
5. 초대를 수락하면 새 WorkspaceMembership이 생성되고 기본 역할은 MEMBER다.
6. ACTIVE Workspace에는 정확히 한 명의 ADMIN이 존재한다. ADMIN 이전 시 대상 ACTIVE MEMBER는 ADMIN, 기존 ADMIN은 MEMBER가 된다. 독립 승격/강등은 제공하지 않는다.
7. ADMIN 이전은 대상자의 수락을 요구하지 않으며 서비스 내 알림으로 통지한다. DocumentGrant는 ADMIN 이전만으로 변경되지 않는다.

### 핵심 흐름 3 — Setlist Document 생성

1. 활성 Workspace 구성원은 SETLIST Document를 생성할 수 있다.
2. Document 생성자는 자동으로 MANAGER가 된다.
3. DocumentAccessPolicy를 OPEN 또는 RESTRICTED로 설정한다.
4. Setlist는 해당 Document와 1:1로 생성된다.
5. MANAGER는 다른 활성 WorkspaceMembership에 Document Role을 부여할 수 있다.

### 핵심 흐름 4 — 찬양 콘티 구성

1. 사용자가 곡을 검색한다.
2. 외부 검색 결과는 비영속 `SongCandidate`로 취급한다.
3. 사용자가 실제 작업 대상으로 선택하면 기존 Workspace Song과 연결하거나 새 Song을 등록한다.
4. SetlistItem에 Song을 연결한다.
5. 필요한 Score를 업로드하거나 기존 Workspace Score를 선택한다.
6. Reference를 직접 URL로 등록하거나 YouTube 검색 결과에서 선택한다.
7. Key, BPM, 세션, 메모를 입력한다.
8. SongForm을 구성한다.
9. 여러 SetlistItem의 순서를 정한다.
10. 저장 시 expectedVersion을 사용하여 stale update를 거부한다.

### 핵심 흐름 5 — YouTube Playlist

1. 공개 YouTube 검색은 검색 Capability를 통해 수행한다.
2. Playlist 생성·수정이 필요한 경우 별도의 YouTube OAuth Authorization이 필요하다.
3. 내부 Setlist가 source of truth다.
4. 외부 Playlist 작업 실패는 내부 Setlist의 정상 저장 상태를 훼손하지 않는다.
5. 외부 실패는 사용자에게 명확히 보고하고 재시도 가능해야 한다.

### 핵심 흐름 6 — Export와 외부 공유

1. 사용자가 특정 Document/Setlist version을 기준으로 Export를 생성한다.
2. Export는 생성 시점의 canonical content를 immutable snapshot으로 고정한다.
3. V1은 최소 PDF Export를 지원한다.
4. 이후 원문이 수정되어도 기존 Export는 변하지 않는다.
5. 비회원/비구성원에게는 Export 파일 자체만 전달할 수 있다.
6. Export 공유가 Workspace나 Document의 접근권한을 생성해서는 안 된다.

최종 콘티 PDF는 악보를 파일명으로만 안내하는 결과물이 아니라 실제 선택한 악보의 전체 페이지를 포함해야 한다. 사용자는 브라우저에서 결과물을 다운로드할 수 있어야 한다. 임시 배치 기준은 전체 곡 순서 → 곡별 안내·SongForm → 해당 악보 전체 페이지이며, 최종 시각 배치는 프론트 담당과 협의한다. 악보 자르기·페이지 재편집은 이 요구에 포함하지 않는다.

### 핵심 흐름 7 — 향후 Agent 연동

Agent는 자연어 의도 해석, 계획 수립, Tool/Capability 선택, 검색 결과 비교, 사용자 추가 질문, 최종 응답 조합을 담당한다.

Core Backend는 실제 조회·저장·수정, 권한 검증, 데이터 정합성, 외부 Provider 호출을 담당한다.

Agent는 DB에 직접 접근하지 않는다. UI와 Agent는 동일한 Application Capability와 AuthorizationPolicy를 사용한다.

Agent의 Runtime 언어, LLM Provider, 대화 저장 방식, Context Compaction, Tool orchestration은 AI 개발자와 후속 논의 후 결정한다.

---

## 3. Domain Model and Invariants

### 3.1 Identity

#### User

서비스 내부의 안정적인 Principal.

User는 Workspace 역할이나 Document 역할을 직접 보유하지 않는다.

#### UserEmail

한 User는 여러 UserEmail을 가질 수 있다.

필수 개념:

- email
- verified 여부
- primary 여부

정책:

- 이메일/비밀번호 로그인 식별자는 primary verified email이다.
- Invitation 수락에는 초대 대상 이메일과 동일한 verified UserEmail이 필요하다.
- 추가 verified email은 Invitation 매칭 및 연락에 사용할 수 있다.
- add / verify / remove / set-primary 흐름을 지원한다.

#### PasswordCredential

이메일/비밀번호 로그인 수단.

User와 로그인 자격증명을 분리한다.

#### ExternalIdentity

Google 등 외부 IdP 로그인 Identity.

식별자는 이메일 문자열이 아니라 `issuer + subject`를 사용한다.

이메일이 같다는 이유만으로 기존 User와 자동 병합하지 않는다.

#### ExternalAuthorization

Google/YouTube API처럼 외부 리소스를 조작하기 위한 OAuth Authorization.

ExternalIdentity와 별개다.

로그인용 Google Identity가 존재한다고 해서 YouTube Playlist 수정 권한이 자동으로 생기지 않는다.

### Identity 추가 정책

- 이메일 비교는 trim 후 case-insensitive canonical value를 사용한다.
- 동일한 verified email은 동시에 둘 이상의 User가 소유할 수 없다.
- 동일 이메일의 동시 verification 경쟁은 DB uniqueness로 한 User만 성공해야 한다.
- Google-only 계정 생성을 허용한다.
- Google에서 `email_verified=true`로 확인된 이메일은 해당 User의 verified UserEmail로 등록할 수 있다.
- 단, 이메일 문자열 일치만으로 기존 User와 Google ExternalIdentity를 자동 연결하지 않는다.
- ExternalIdentity 연결은 로그인된 User의 명시적 link 흐름에서만 수행한다.
- ExternalIdentity unlink, PasswordCredential 제거, UserEmail 제거 시 최소 하나의 사용 가능한 로그인 수단이 남아야 한다.
- primary email 변경 및 로그인 수단 연결/해제는 최근 재인증을 요구한다.
- password reset은 primary verified email을 대상으로 한다.
- password reset 성공 시 기존 모든 Session을 무효화한다.
- password change 성공 시 현재 Session을 제외한 기존 Session을 무효화한다.
- OAuth/OIDC login 및 linking에서는 state/nonce와 link intent를 검증하고 재사용을 거부한다.

---

### 3.2 Workspace

#### Workspace

제품 용어로는 Workspace이며 아키텍처 관점에서는 Tenant 경계다.

Workspace는 다음의 경계다.

- 데이터
- 협업
- 권한

현실 교회의 조직 구조와 자동으로 부모/자식 관계를 만들지 않는다.

Workspace 상태는 ACTIVE / TERMINATED다. 2026-10-07 후속 사용자 승인으로 기존 P-01의 단독 구성원 제한을 대체한다. 유일 ADMIN은 ACTIVE 구성원 수와 관계없이 명시적 확인 후 Workspace를 종료할 수 있다. 종료와 모든 ACTIVE Membership의 ENDED 전환, 미수락 초대 무효화, 종료 알림 기록은 하나의 transaction에서 처리한다. 종료 확정 시점은 DB commit이며, 기존 URL·Session·초대 또는 늦게 완료된 작업이 접근을 되살리지 않아야 한다. 종료는 즉시 영구 삭제를 뜻하지 않는다. V1 사용자용 재개/복구는 제공하지 않고 운영자 복구도 보장하지 않는다. 보존/삭제 기간은 PROJECT.md에서 별도 결정한다.

종료 확인에는 ACTIVE 구성원 수, Document 수, 진행 중 작업 존재 여부와 접근 차단·즉시 영구 삭제 아님·복구 불가/미보장·외부 작업 일부 반영 가능성을 안내하고 Workspace 이름 재입력을 요구한다. 접근권한 없는 Document 제목/내용은 공개하지 않는다. 확인 이후 권한·대상·영향 범위가 바뀌면 실행하지 않고 재확인을 요구한다. 구체 확인 계약은 구현에서 정의하되 재검사와 원자성을 생략하지 않는다.

종료된 공간은 일반 목록에서 제외한다. 종료 당시 구성원은 자신의 로그인 계정으로 최소 종료 알림/상태만 확인할 수 있고 자료·구성원 목록은 볼 수 없다. 무관한 사용자에게 공간 존재/종료 여부를 공개하지 않는다. 이미 다운로드한 파일은 회수할 수 없으며 외부 서비스에서 이미 수행한 작업의 완전한 rollback은 보장하지 않는다.

#### WorkspaceMembership

User와 Workspace의 실제 소속 관계.

역할:

- `ADMIN`
- `MEMBER`

상태:

- `ACTIVE`
- `ENDED`

종료 이유 예:

- `LEFT`
- `REMOVED`
- `USER_WITHDRAWN`

V1에는 `SUSPENDED`를 두지 않는다.

불변식:

- 하나의 User는 여러 Workspace에 서로 다른 역할로 참여할 수 있다.
- Workspace 생성자는 ADMIN이 된다.
- 초대 수락 시 기본 MEMBER가 된다.
- ADMIN만 구성원 초대, MEMBER 제거, ADMIN 이전, Workspace 종료를 수행한다.
- 활성 Workspace에는 정확히 1명의 ACTIVE ADMIN이 유지되어야 한다. ADMIN 이전만 기존 ADMIN을 MEMBER로 바꾸며 독립 승격/강등과 다른 ADMIN 제거는 제공하지 않는다.
- ADMIN은 책임 이전 없이 활성 Workspace를 떠나거나 회원탈퇴할 수 없다. Workspace를 명시적으로 종료하면 모든 소속을 종료할 수 있다.
- ADMIN 이전은 대상 ACTIVE Membership의 수락을 요구하지 않는다. 역할 변경과 서비스 내 알림 기록은 하나의 transaction에서 처리한다.
- 지정 통지는 서비스 내 알림으로 제공하며 이메일은 보내지 않는다(2026-10-07 사용자 후속 결정). Workspace 구성원끼리 표시 이름만 공유하고 타인의 이메일은 공개하지 않는다. 표시 이름은 권한/신원의 식별자가 아니다.
- ENDED Membership을 다시 ACTIVE로 되살리지 않는다.
- 재가입 시 새 WorkspaceMembership을 생성한다.
- 과거 Membership에 귀속된 DocumentGrant는 새 Membership으로 자동 복원되지 않는다.

#### WorkspaceInvitation

초대와 Membership은 별도 개념이다.

상태:

- `PENDING`
- `ACCEPTED`
- `EXPIRED`
- `REVOKED`

불변식:

- Invitation은 이메일 주소를 대상으로 한다.
- 초대 대상은 Gmail로 제한하지 않는다.
- 수락 시 해당 이메일이 현재 User의 verified UserEmail인지 확인한다.
- 토큰은 단일 사용, 만료, 서버 저장 시 해시 저장 원칙을 따른다.
- ACCEPTED/EXPIRED/REVOKED Invitation은 다시 수락할 수 없다.

---

### 3.3 Document

#### Document

Workspace 내부에서 협업 및 권한 경계를 제공하는 공통 개념.

V1의 `DocumentType`은 `SETLIST`만 존재한다.

Document를 두는 이유는 향후 주보·설교 등 다른 작업 결과로 확장할 수 있는 공통 권한 경계를 제공하기 위함이다. 단, V1에서는 범용 Document editor나 범용 Template 시스템을 구현하지 않는다.

#### DocumentAccessPolicy

- `OPEN`
- `RESTRICTED`

`OPEN`:

- 해당 Workspace의 ACTIVE Membership이면 별도 VIEWER Grant 없이 조회 가능
- 수정은 MANAGER 또는 EDITOR Grant가 필요
- Workspace 외부 공개를 의미하지 않음

`RESTRICTED`:

- 명시적인 DocumentGrant가 있는 ACTIVE Membership만 조회 가능
- Workspace ADMIN도 우회하지 못함
- 권한이 없는 사용자에게 제목·내용 등 문서 정보가 노출되지 않아야 함

#### DocumentGrant

Document 권한은 User가 아니라 WorkspaceMembership에 귀속한다.

역할:

- `MANAGER`
- `EDITOR`
- `VIEWER`

권한:

- MANAGER: 조회, 수정, Document 권한 관리
- EDITOR: 조회, 수정
- VIEWER: 조회

불변식:

- Document 생성자는 자동 MANAGER다.
- Grant 대상 Membership과 Document는 동일 Workspace에 속해야 한다.
- MANAGER만 Grant를 부여·변경·회수할 수 있다.
- 일반 Grant 변경으로 마지막 MANAGER를 제거하거나 강등할 수 없다. 유일 MANAGER의 자발적 공간 탈퇴/서비스 탈퇴는 먼저 책임 이전을 요구한다.
- ADMIN의 MEMBER 강제 제거에는 예외가 있다. 대상이 유일 MANAGER인 Document의 영향 범위를 확인한 뒤 ADMIN에게 MANAGER Grant를 부여하고 대상 소속을 종료하는 작업을 하나의 transaction에서 처리한다. 접근권한 없는 문서는 제목/내용 없이 영향 문서 수만 안내하며, 확인 이후 영향 범위가 바뀌면 재확인을 요구한다. 다른 MANAGER가 남는 문서는 승계하지 않는다. 승계 후 ADMIN의 Grant를 자동 회수/강등하지 않는다.
- Workspace 종료 시에는 모든 Membership을 종료하며, 종료된 Document는 접근 불가이므로 활성 MANAGER 유지를 요구하지 않는다.
- MANAGER 지정은 대상 ACTIVE Membership의 수락을 요구하지 않는다. 역할 변경과 서비스 내 알림 기록은 하나의 transaction에서 처리한다. ADMIN 이전과 Document MANAGER 지정은 서로 다른 권한 작업이다.
- MANAGER 지정 통지도 서비스 내 알림만 사용하며 이메일은 제외한다. 알림 조회에서도 현재 ACTIVE Membership과 Document 접근 경계를 유지한다.
- Membership이 ENDED되면 해당 Membership의 Document 권한은 사용할 수 없다.
- Workspace ADMIN은 ADMIN 역할만으로 Document 권한 관리자가 되지 않는다. 위의 명시적 확인을 거친 유일 MANAGER MEMBER 제거/승계만 예외이며, 승계 전 RESTRICTED 접근은 금지한다.

---

### 3.4 Setlist

#### Setlist

SETLIST Document의 찬양 콘티 본문.

Document와 1:1 관계다.

Setlist는 문서 접근/권한을 중복 보유하지 않는다. 권한 경계는 Document가 담당한다.

#### SetlistItem

Setlist 안에서 특정 곡을 이번 예배에서 어떻게 사용할지를 표현하는 순서 있는 항목.

다음 정보는 Song 자체가 아니라 SetlistItem에 귀속한다.

- 사용 순서
- Key
- BPM
- 세션 구성
- 메모
- 선택 Score
- 선택 Reference
- SongForm

이유는 같은 Song도 예배마다 Key, BPM, 악보, Reference, SongForm이 달라질 수 있기 때문이다.

Setlist 및 SetlistItem 수정은 optimistic version을 사용한다. 모든 변경 요청은 `expectedVersion`을 제공해야 하며, stale version은 조용히 덮어쓰지 않고 conflict로 응답한다.

---

### 3.5 Song

#### Song

Workspace 안에서 재사용되는 곡 자체의 개념.

V1에서는 서비스 전역 공용 Song Catalog를 만들지 않는다.

#### SongCandidate

외부 검색 결과의 일시적인 후보.

영속 데이터가 아니다.

정책:

- 검색 결과가 0건이라는 이유만으로 “실제로 존재하지 않는 곡”이라고 단정하지 않는다.
- 제목이 같다는 이유만으로 기존 Song과 자동 병합하지 않는다.
- 사용자가 실제 작업 대상으로 선택한 뒤에만 Workspace Song에 등록 또는 연결한다.
- 기존 Song과 동일한지 불확실하면 자동 병합하지 않는다.

---

### 3.6 Score

사용자가 직접 확보하여 업로드한 악보.

정책:

- 서비스가 저작권 악보를 직접 수집·재배포하는 구조를 만들지 않는다.
- V1에서는 동일 Workspace 내부에서만 재사용한다.
- 다른 Workspace의 사용자에게 자동 제공하지 않는다.
- 구매 페이지나 검색 페이지 등 외부 확보 경로를 안내할 수 있다.
- 커뮤니티 기반 악보 탐색은 V1 비목표다.

파일 저장은 ObjectStorage port를 통한다.

Object Storage와 DB는 하나의 원자적 트랜잭션이 아니므로 실패 경계를 명시한다.

예:

1. 파일 업로드 성공
2. DB 저장 실패
3. 업로드 파일에 대해 best-effort 보상 삭제
4. 삭제 실패는 관찰 가능하게 기록

허용 파일 형식, 최대 크기, MIME, 실제 파일 유효성 검증을 적용한다.

---

### 3.7 Reference

곡 준비에 사용하는 외부 참고자료.

V1에서는:

- 사용자 직접 URL 입력
- YouTube 검색 결과 선택

을 지원한다.

Reference가 Song 자체의 영구적인 “정답”을 의미하지 않는다. 특정 SetlistItem에서 실제 사용할 Reference를 선택한다.

V1에서 링크를 바로잡으려면 새 Reference를 등록하거나 기존 Reference를 선택하여 해당 SetlistItem의 선택을 교체한다. 공유 Reference의 URL·제목 자체를 수정하는 기능은 제공하지 않는다(2026-10-07 사용자 결정 P-03). 선택 교체는 Document 수정 권한과 expectedVersion을 요구한다.

---

### 3.8 SongForm

특정 SetlistItem에서 사용할 곡 진행 구조.

V1에서는 자유 텍스트 하나가 아니라 검증 가능한 구조형 데이터로 저장한다.

보존해야 하는 의미:

- 순서
- section
- repeat
- cue / calling / note
- stable block identity
- version

예시 의미:

`Intro → A → B → A x2 → Bridge`

물리 저장 방식은 구현에서 결정할 수 있으나 위 의미 구조를 잃어서는 안 된다.

V1에서 CRDT/OT를 사용하지 않는다.

---

### 3.9 Export

특정 Document/Setlist version의 immutable 결과물.

불변식:

- Export는 생성 당시 source version과 canonical content를 기록한다.
- 원본 Document가 이후 수정돼도 기존 Export는 바뀌지 않는다.
- Export를 받은 외부인에게 Workspace/Document 접근권한이 생기지 않는다.
- V1 최소 지원 형식은 PDF다.
- PDF에 선택 악보의 실제 전체 페이지를 포함하고 브라우저 다운로드를 지원한다. P-04의 배치는 임시 기준이며, 입력 고정은 악보 원본의 식별·불변성·파일 수명까지 고려해야 한다.
- PDF Export 생성 및 생성 재시도는 Document 수정과 같은 권한 수준이다. 해당 Workspace의 ACTIVE Membership에 EDITOR 또는 MANAGER Grant가 있어야 한다.
- Export 목록/메타데이터 조회 및 다운로드는 현재 Document 조회 권한을 요구한다. VIEWER 또는 OPEN의 ACTIVE Membership은 기존 결과물을 조회/다운로드할 수 있지만 생성할 수 없다.
- 생성 중 EDIT 권한을 잃으면 성공 artifact를 확정하지 않는다. Workspace ADMIN이라는 이유만으로 생성 권한을 우회하지 못한다.

---

## 4. Functional Policies

### 4.1 Workspace 관리

- verified User는 Workspace를 생성할 수 있다.
- 생성자는 ADMIN.
- ADMIN만 구성원 관리 가능.
- MEMBER 제거 전에 유일 MANAGER 영향 범위를 확인하고 필요한 Document의 ADMIN 승계와 소속 종료를 원자적으로 처리한다.
- 활성 Workspace에서 ADMIN 본인이 떠나려면 ACTIVE MEMBER에게 ADMIN을 이전해야 한다. ADMIN 이전은 DocumentGrant를 자동 변경하지 않는다.
- 활성 Workspace에서 본인이 어떤 Document의 유일 MANAGER라면 먼저 책임을 이전해야 한다.
- 유일 ADMIN은 구성원 수와 관계없이 확인 후 Workspace를 종료하고 모든 소속을 종료할 수 있다.
- Workspace hard delete 및 복잡한 archive lifecycle은 V1에서 제공하지 않는다. 위의 최소 종료 경로는 영구 삭제와 구분한다.

### 4.2 Document 관리

- 일반 ACTIVE MEMBER도 Document 생성 가능.
- 생성자는 MANAGER.
- OPEN/RESTRICTED 변경은 MANAGER만 가능.
- MANAGER/EDITOR/VIEWER 권한은 ACTIVE WorkspaceMembership에만 부여 가능.
- Document hard delete는 V1의 핵심 범위에서 제외한다.

### 4.3 계정 생명주기

지원:

- signup
- email verification
- password login
- logout
- password change
- password reset
- Google login
- Google identity link/unlink
- UserEmail add/verify/remove/set-primary
- withdraw

회원탈퇴:

- 모든 로그인 Session 종료
- PasswordCredential 제거/비활성화
- ExternalIdentity 연결 종료
- ExternalAuthorization 폐기
- 모든 ACTIVE WorkspaceMembership 종료
- 개인정보 최소화/비식별화
- 과거 업무 데이터와 필요한 감사 이력은 관계 무결성을 유지하는 방식으로 보존
- 재가입은 새로운 User
- 과거 Workspace/Document 권한 자동 복원 금지

활성 Workspace의 ADMIN 또는 유일 MANAGER 책임이 남아 있으면 자발적 탈퇴를 거부하고 먼저 책임 이전을 요구한다. 명시적으로 종료된 공간의 마지막 책임자 때문에 탈퇴를 막지 않는다. 서비스 탈퇴가 공간 종료를 자동 수행하지 않는다. 여러 공간의 소속·계정 탈퇴는 기존 all-or-nothing 보장을 유지한다.

탈퇴한 작성자 때문에 다른 구성원이 사용하는 공동 콘티·악보·Reference를 연쇄 삭제하지 않는다. 작성자 표시가 있는 화면에서는 ‘탈퇴한 사용자’로 표현한다(P-05). 구성원끼리는 표시 이름만 공유하고 타인의 이메일은 공개하지 않는다. 로그인 수단·Session·로컬 YouTube 연결 제거 또는 화면 표시 변경이 모든 개인정보 삭제나 provider revoke 완료를 뜻하지 않는다. 데이터별 보관 기간·삭제/익명화·백업 정책은 PROJECT.md에서 결정한다.

추가 계정 생명주기 규칙:

- primary email 변경과 로그인 수단 연결/해제는 최근 재인증 이후에만 허용한다.
- PasswordCredential, ExternalIdentity, UserEmail을 제거하는 작업은 제거 후에도 최소 하나의 사용 가능한 로그인 수단이 남는지 검증한다.
- password reset은 primary verified email을 대상으로 하며 성공 시 기존 모든 Session을 무효화한다.
- password change 성공 시 현재 변경 흐름에 사용된 Session을 제외한 다른 기존 Session을 무효화한다.
- OAuth/OIDC login 및 linking은 state/nonce와 link intent를 검증하고, 이미 사용한 link intent의 재사용을 거부한다.

### 4.4 이메일

이메일은 다음 도메인 행동의 결과로 발송한다.

- 회원가입 이메일 인증
- 비밀번호 재설정
- Workspace Invitation
- 필요한 보안 알림

범용 `send-email` 제품 API를 만들지 않는다.

`EmailSender` port를 통해 Provider를 격리한다.

V1에서는 범용 DB 메일 큐/메시지 브로커를 만들지 않는다. 전송 실패가 핵심 도메인 상태를 깨뜨리지 않도록 재전송 가능한 단순 구조를 사용한다.

### 4.5 YouTube

지원:

- 공개 영상 검색
- 사용자 YouTube OAuth 연결/해제
- Playlist 생성
- Playlist item 추가/삭제/순서 변경
- 기존 Playlist 동기화/수정

정책:

- Google 로그인 Identity와 YouTube Authorization을 분리한다.
- 최소 OAuth scope를 요청한다.
- refresh token 등 장기 credential은 보호/암호화하여 저장한다.
- 연결 해제 시 로컬 credential을 제거하고 가능한 경우 Provider revoke를 수행한다.
- 내부 Setlist가 source of truth다.
- 외부 실패 때문에 이미 유효한 내부 Setlist를 롤백하지 않는다.
- DB 트랜잭션을 잡은 채 장시간 외부 API를 호출하지 않는다.

### 4.6 Agent 연동 정책

Core Backend 초기 구현은 Agent 구현 세부사항에 종속되지 않는다.

Backend가 제공해야 하는 것은 의미 있는 Application Capability다.

예:

- 계정/Workspace/Document 조회 및 변경
- song candidate search
- workspace song 등록/선택
- score upload/select
- reference search/select
- setlist item add/remove/reorder
- song form update
- YouTube playlist create/update
- export generate

Agent Tool은 DB row 조작이나 범용 SQL이 아니라 이러한 도메인 행동을 호출해야 한다.

향후 Agent 연동 시:

- 조회/검색은 즉시 실행 가능
- 생성/수정/삭제/외부 side effect는 V1 정책상 사용자 승인 후 실행
- Approval과 Authorization은 별개
- 승인 후에도 Backend가 실행 시점의 권한을 다시 검증
- Agent는 DB에 직접 접근하지 않음
- Tool과 HTTP endpoint의 1:1 대응을 강제하지 않음

Approval token/protocol, 대화 Session, LLM Context, Compaction, Tool planner의 구체 구현은 AI 개발자와 통합 단계에서 결정한다.

### 4.7 Application Capability 범위

#### Account

- signup
- verify email
- add/verify/remove/set-primary user email
- password login/logout/change/reset
- Google login/link/unlink
- withdraw

#### Workspace

- create/get/list
- invite/revoke/resend/accept
- list members
- remove member
- promote member to admin
- leave
- close a Workspace where the actor is its sole ACTIVE member, then end membership

#### Document

- create
- list/get accessible documents
- change access policy
- grant/change/revoke document role

#### Setlist

- create/get/update
- add/remove/reorder item
- update per-item musical settings
- update notes
- update SongForm

#### Song / Score / Reference

- search song candidates
- list Workspace Songs
- register/select Song
- upload/list/select Score
- direct Reference URL registration
- YouTube Reference search/select; update means replacing the selected Reference, not editing shared URL/title

#### YouTube

- public video search
- connect/disconnect authorization
- create/update Playlist
- add/remove/reorder Playlist items

#### Export

- generate immutable Export for a specific source version
- download Export

PDF 생성/재시도는 EDIT, 결과물 조회/다운로드는 READ 권한을 사용한다(2026-10-01 사용자 명시 결정).

Capability 이름은 코드/HTTP/Agent Tool에서 가능한 한 같은 도메인 어휘를 사용하되, 구현 레이어마다 1:1 이름 일치를 강제하지 않는다.

---

## 5. Constraints

### 제품 제약

- Workspace가 Tenant 경계다.
- 실제 교회 조직도와 Workspace 구조를 동일시하지 않는다.
- Church entity를 V1 핵심에 추가하지 않는다.
- 교회별 전체 예배 Workflow를 강제하지 않는다.
- V1 콘티 출력 형식은 서비스 표준 형식을 사용한다.
- 사용자 기존 템플릿 이미지 자동 인식은 V1 이후 검토한다.
- Workspace 외부 사용자는 내부 리소스에 접근할 수 없다.
- 외부 공유는 Export 파일을 통해서만 수행한다.

### 기술 제약

- Core Backend가 서비스 데이터와 권한의 최종 권위자다.
- Agent/Frontend가 도메인 권한을 자체 판단하여 우회할 수 없다.
- 모든 Workspace-scoped query는 Tenant 경계를 포함해야 한다.
- JPA Entity를 API 응답으로 직접 반환하지 않는다.
- 스키마 변경은 Flyway로만 수행한다.
- production에서 Hibernate 자동 스키마 생성에 의존하지 않는다.
- 외부 Provider를 Application/Domain 로직에 직접 결합하지 않는다.
- 배포 Provider에 종속된 Domain/Application 코드를 만들지 않는다.

---

## 6. Architecture

### 6.1 Core Backend

형태:

**Single-deployable Modular Monolith**

기준 스택:

- Java 25 LTS
- Spring Boot 4.1.x stable baseline
- Gradle
- MySQL 8.4 LTS
- Spring Data JPA
- Flyway
- Spring Security
- Spring Session JDBC
- Bean Validation
- OpenAPI
- JUnit
- Testcontainers

코드 구조는 package-by-feature를 사용한다.

예시 feature 경계:

- identity
- workspace
- document
- setlist
- song
- integration
- export
- audit

각 feature 내부에서 api/application/domain/infrastructure 역할을 분리할 수 있다. 이 구조 자체가 목적은 아니며 도메인 경계와 의존 방향을 명확하게 하기 위한 수단이다.

Spring Modulith 라이브러리는 V1 필수가 아니다.

### 6.2 인증과 인가

브라우저 인증:

`Browser → Session Cookie → Spring Security → Authenticated Actor`

Application 호출:

`Authenticated Actor → Application Service → AuthorizationPolicy → Domain/Repository`

Spring Security 책임:

- authentication plumbing
- SecurityContext
- server-side Session 연동
- CSRF protection
- PasswordEncoder
- OAuth2/OIDC login
- 인증 실패/성공 처리

Application/Domain 책임:

- WorkspaceMembership 확인
- WorkspaceRole 판단
- DocumentAccessPolicy 판단
- DocumentGrant 판단
- 구성원 관리 가능 여부
- 문서 수정 가능 여부
- Agent를 통한 실행도 동일 정책으로 검증

도메인 코드에서 Spring Security 타입에 직접 의존하지 않고 프레임워크 독립적인 Actor 식별자를 전달한다.

### 6.3 Browser Session

first-party Web 서비스의 브라우저 인증은 server-side Session을 사용한다.

세션 저장은 Spring Session JDBC + MySQL을 사용한다.

Session에는 User 식별 중심의 최소 인증 정보만 둔다. Workspace role, Document grant 같은 변경 가능한 도메인 권한을 장기 캐시하지 않는다.

세션 쿠키는 Secure, HttpOnly, 적절한 SameSite 정책을 적용한다.

CSRF 방어를 활성화한다.

Spring Session JDBC 스키마도 Flyway로 관리하며 production 자동 schema initialization에 의존하지 않는다.

### 6.4 Password

비밀번호는 Argon2id 계열의 adaptive password hashing을 사용한다.

원문 비밀번호는 저장하지 않는다.

비밀번호 변경/재설정 및 회원탈퇴 시 기존 Session 처리 정책을 명확히 적용한다.

### 6.5 Database

- MySQL 8.4 LTS
- 내부 식별자는 BIGINT AUTO_INCREMENT
- 시간 저장은 UTC / Instant
- DB constraint를 적극 활용
- blanket soft delete 금지
- lifecycle이 있는 개념은 명시적 상태로 표현
- `ddl-auto=validate`
- 필요한 aggregate에 optimistic version 적용

### 6.6 External Systems

모든 외부 시스템은 port/adapter로 격리한다.

- Email Provider
- Object Storage
- Google OIDC
- Google/YouTube OAuth
- YouTube Data API
- Export renderer

외부 호출은 장기 DB 트랜잭션 내부에서 수행하지 않는다.

### 6.7 Agent/AI

Agent/AI Runtime은 별도 개발자 책임 영역이다.

따라서 현재 Core Backend 설계는:

- Python
- Rust
- 특정 LLM SDK
- 특정 Agent framework
- 특정 Context storage

에 종속되지 않는다.

통합 시 Backend의 Application Capability와 AuthorizationPolicy를 사용한다.

---

## 7. Data and External Contracts

### 데이터 소유 경계

모든 Workspace-scoped 자원은 Workspace 경계를 위반하여 참조되거나 조회되어서는 안 된다.

주요 귀속:

- WorkspaceMembership → Workspace
- Document → Workspace
- DocumentGrant → Document + WorkspaceMembership
- Setlist → Document
- Song → Workspace
- Score → Workspace, 필요 시 Song 연계
- Reference → Workspace 또는 관련 Song/사용 맥락
- SetlistItem → Setlist + Song
- Export → source Document/Setlist version

### 외부 식별자

Provider에서 받은 식별자는 내부 PK와 분리한다.

예:

- Google issuer/subject
- YouTube video id
- YouTube playlist id
- Object Storage object key

외부 식별자가 내부 데이터 소유권을 결정하지 않는다.

### 상태 변경 명령

중복 요청이나 외부 재시도로 인해 상태 변경이 중복 실행되지 않아야 한다.

특히 다음 Capability는 command/idempotency 식별자를 수용할 수 있는 경계를 둔다.

- Workspace Invitation 발송
- Export 생성
- YouTube Playlist 생성
- 외부 side effect가 포함된 기타 상태 변경

구체적인 key 생성/보존 방식은 구현 단계에서 단순성을 우선해 결정할 수 있다.

### Audit

V1에서는 보안/책임 추적에 필요한 최소 AuditLog만 둔다.

주요 대상:

- 계정 보안 이벤트
- Workspace Membership/Role 변경
- Document access policy 변경
- Document Grant 변경
- 외부 OAuth 연결/해제

DomainEvent, AuditLog, UserBehaviorEvent, AgentContext는 동일 개념으로 합치지 않는다.

UserBehaviorEvent와 AgentContext의 구체 저장 구조는 V1 Core Backend 범위가 아니다.

---

## 8. Important Technical Decisions

### Spring Boot Core Backend

**결정:** Spring Boot 기반 Modular Monolith.

**근거:**

- 사용자/Workspace/Document 권한과 상태 전이가 많음
- 초대, 탈퇴, 권한 회수, 동시 수정 등 트랜잭션 규칙이 핵심
- Spring Security, Transaction, Validation, JPA, Test 생태계를 활용 가능
- Backend 담당자의 현재 기술 경험과 부합
- 3인 팀에서 마이크로서비스 운영 복잡도를 피할 수 있음

**대안/Trade-off:**

- 다른 언어/프레임워크도 구현 가능하지만 현재 요구를 해결하면서 팀 학습·운영 비용을 낮추는 이점이 더 작음
- 모놀리스 내부 경계를 지키지 않으면 결합도가 높아질 수 있으므로 package-by-feature와 테스트로 경계를 보호

### Server-side Session

**결정:** first-party browser 인증은 JWT access token 중심 구조가 아니라 server-side Session.

**근거:**

- Workspace/Document 권한이 자주 변경될 수 있음
- 추방/탈퇴/권한 회수를 즉시 반영해야 함
- 브라우저 first-party 애플리케이션이 핵심 클라이언트
- 세션 무효화와 로그아웃 의미가 명확
- JWT 자체에 장기 role/grant를 싣는 구조를 피할 수 있음

**Trade-off:**

- 서버측 Session 저장소가 필요
- Cookie 기반 인증이므로 CSRF 방어가 필요

### Spring Session JDBC

**결정:** Session 저장에 별도 Redis가 아니라 기존 MySQL을 활용하는 Spring Session JDBC.

**근거:**

- 이미 MySQL을 필수 운영
- V1에 Redis를 추가할 실질적 요구가 없음
- 서버 재시작 및 향후 복수 인스턴스에서도 Session 공유 가능
- 인프라 수를 늘리지 않음

**재검토 조건:**

- 실제 Session 부하가 MySQL에 의미 있는 병목을 만들거나
- 운영 규모가 JDBC Session 저장의 비용을 넘어서는 경우

### Spring Security의 제한된 책임

**결정:** Spring Security는 인증 인프라, 도메인 인가는 Application/Domain AuthorizationPolicy.

**근거:**

- 동일 User가 Workspace마다 다른 Role을 가짐
- Document 권한은 Workspace Role과 독립적
- ADMIN도 RESTRICTED Document를 우회하지 못함
- 향후 Agent도 동일 정책을 사용해야 함

따라서 전역 `hasRole('ADMIN')` 같은 방식으로 도메인 권한을 표현하지 않는다.

### MySQL

**결정:** MySQL 8.4 LTS.

**근거:**

- 관계/constraint/transaction이 중심인 도메인
- 팀의 기존 MySQL 사용 경험
- V1 규모에서 별도 데이터베이스 기술을 도입할 요구 없음

### Workspace-local Song Catalog

**결정:** Song은 V1에서 Workspace 소속.

**근거:**

- 서비스 전역 곡 동일성 판별 정책이 아직 필요하지 않음
- 전역 Catalog를 만들면 동명이곡, metadata 검증, merge 정책이 추가됨
- 현재 목표는 각 Workspace의 찬양 준비 효율화

**재검토 조건:**

- 여러 Workspace 간 검증된 곡 metadata 공유가 핵심 제품 요구가 되는 경우

### Document abstraction

**결정:** V1부터 Document 권한 경계는 사용하되 DocumentType은 SETLIST 하나만 구현.

**근거:**

- Workspace 권한과 실제 작업물 권한 분리는 현재 요구
- 향후 예배 준비의 다른 작업물도 동일 권한 경계를 사용할 가능성이 높음
- Setlist에 Workspace/Document 권한 로직을 직접 박으면 이후 중복 가능성이 높음

**과설계 방지:**

- 범용 editor
- Template engine
- arbitrary DocumentType framework

은 V1에서 만들지 않는다.

### Optimistic concurrency

**결정:** V1에서 expectedVersion 기반 optimistic concurrency.

V1 최소 사용자 흐름은 충돌 시 화면의 입력을 유지하고 최신본을 별도로 확인·비교·복사하여 수동 재저장하는 방식이다(P-06). expectedVersion만 최신으로 바꾸어 이전 초안을 자동 재전송하지 않는다. 401/403은 version conflict와 구분하며 권한 없는 최신본을 조회하지 않는다. 자동 병합, 새로고침·브라우저 종료 후 초안 복구는 현재 V1 최소 범위에 포함하지 않는다. 화면 입력 보존은 프론트 책임이고 Backend의 충돌 거부 테스트만으로 화면 완료를 주장하지 않는다.

**근거:**

- 실시간 공동편집 전에도 여러 사용자의 stale write로 데이터가 유실될 수 있음
- DB lock을 장시간 유지할 필요 없음
- 향후 공동편집으로 확장하기 전 최소 정합성 보호 가능

### Agent Runtime 미고정

**결정:** Core Backend Design Lock에서 Agent Runtime 기술을 고정하지 않음.

**근거:**

- Agent/LLM은 별도 개발자 책임
- 아직 LLM Provider, Tool orchestration, Context 방식이 합의되지 않음
- Backend는 Agent 기술과 무관하게 안정적인 Capability 계약을 제공해야 함

---

## 9. Risk Model

Risk level: **CRITICAL**

이는 제품 규모를 뜻하지 않는다. 검증 강도를 결정하는 분류다.

### 핵심 위험

1. Tenant isolation 실패
   - 다른 Workspace의 데이터가 노출될 수 있음

2. 권한 우회
   - Workspace ADMIN이 RESTRICTED Document를 읽음
   - EDITOR/VIEWER가 허용되지 않은 동작 수행

3. 생명주기 복구 오류
   - 재가입한 User가 과거 Membership의 Grant를 다시 획득
   - 마지막 ADMIN/MANAGER가 사라짐

4. 인증/계정 연결 오류
   - 이메일 일치만으로 Google 계정이 잘못 병합됨
   - 만료/사용 완료 token이 재사용됨

5. 동시 수정 데이터 유실
   - stale client가 최신 Setlist를 덮어씀

6. Object Storage와 DB 불일치
   - 파일만 남거나 DB row만 남음

7. 외부 OAuth credential 노출 또는 오용

8. YouTube partial failure
   - 외부 실패가 내부 Setlist 정합성을 깨뜨림

9. immutable Export 위반
   - 원본 수정이 과거 Export를 변경함

10. 향후 Agent 권한 우회
    - Agent의 판단 또는 사용자 승인만 믿고 Backend Authorization을 생략함

---

## 10. Acceptance and Verification Strategy

테스트 개수가 아니라 다음 불변식이 실제로 보장되는지를 검증한다.

### Authentication

- 미인증 사용자는 보호 자원 접근 불가
- 이메일 인증 정책이 의도대로 동작
- 비밀번호 reset token은 만료·단일 사용
- Google identity는 issuer+subject로 식별
- 동일 이메일이라는 이유만으로 기존 User와 Google ExternalIdentity가 자동 병합되지 않음
- 회원탈퇴 후 기존 Session 사용 불가
- 동일 verified email을 둘 이상의 User가 동시에 소유할 수 없음
- 동일 이메일 verification 경쟁에서는 DB uniqueness로 하나만 성공
- 마지막 사용 가능한 로그인 수단 제거 거부
- primary email 변경 및 로그인 수단 연결/해제 시 최근 재인증 요구
- password reset 성공 후 기존 모든 Session 사용 불가
- password change 성공 후 다른 기존 Session 사용 불가
- 사용 완료된 Google/OAuth/OIDC link intent 재사용 거부
- CSRF 보호가 상태 변경 요청에 적용

### Workspace / Tenant

- 다른 Workspace의 ID를 직접 사용해도 데이터 접근 불가
- MEMBER는 구성원 관리 불가
- ADMIN은 MEMBER만 제거 가능
- 활성 공간 ADMIN의 일반 leave/withdraw 거부; ADMIN 이전과 단독/다수 구성원 종료는 별도 성공 검증
- ADMIN 이전의 정확히 한 명 불변식/rollback, 유일 MANAGER MEMBER 제거 시 확인·승계/다른 MANAGER 존재 시 미승계 검증
- 공간 종료와 초대 수락 경쟁에서 상태·원자성 유지; 종료 후 기존 URL/Session/초대/늦은 작업 확정 차단 및 최소 종료 알림의 수신자 격리
- ENDED Membership을 통한 접근 불가
- 재가입 Membership에 과거 Grant 미복원

### Document Authorization

반드시 다음 경로를 검증한다.

- OPEN + ACTIVE MEMBER + Grant 없음 → 조회 가능
- OPEN + Workspace 외부 User → 조회 불가
- OPEN + Grant 없음 → 수정 불가
- RESTRICTED + Grant 없음 + MEMBER → 조회 불가
- RESTRICTED + Grant 없음 + ADMIN → 조회 불가
- VIEWER → 조회 가능, 수정 불가
- EDITOR → 조회/수정 가능, 권한 관리 불가
- MANAGER → 조회/수정/권한 관리 가능
- 다른 Workspace Membership에 Grant 부여 불가
- 일반 Grant 변경의 마지막 MANAGER 제거/강등 불가; 강제 MEMBER 제거 시 확인을 거친 ADMIN 승계, 자발적 탈퇴의 책임 이전 필수

### Setlist / Concurrency

- stale expectedVersion 변경 요청은 conflict
- 충돌 거부 후 기존 데이터 무변경, 화면 입력 유지·최신본 비교·수동 재저장은 실제 프론트 통합에서 별도 확인
- 곡 순서 변경이 원자적으로 유효한 상태를 보존
- 같은 제목의 Song을 자동 병합하지 않음
- 검색 0건을 존재하지 않는 곡으로 저장하지 않음

### Score

- Workspace 경계 밖 Score 조회/선택 불가
- 허용되지 않은 파일 형식/크기 거부
- Object Storage 성공 후 DB 실패 시 compensation 경로 검증
- 실패한 보상 작업이 관찰 가능

### YouTube

- Authorization이 없으면 Playlist mutation 불가
- OAuth 연결 해제 후 mutation 불가
- 외부 API 실패가 내부 Setlist를 손상하지 않음
- 중복 재시도로 Playlist 생성이 중복되지 않도록 보호

### Export

- 지정한 source version과 내용이 일치
- 실제 선택 악보의 전체 페이지를 포함하고 혼합 형식·다중 페이지·한글의 내용/순서/가독성을 확인
- 원본 수정 후 기존 Export 불변
- Export 다운로드가 Workspace/Document 권한을 생성하지 않음
- EDITOR/MANAGER만 PDF 생성/재시도 가능; VIEWER/OPEN 무Grant/ADMIN 무Grant의 생성 거부
- 생성 거부 시 snapshot/render/storage 작업 미실행; 생성 중 VIEWER 강등 시 artifact 확정 거부
- 생성 권한을 잃어도 READ가 남으면 기존 PDF 다운로드 가능

### Database / Migration

- 깨끗한 MySQL에서 Flyway 전체 migration 성공
- 기존 최신 schema에서 애플리케이션 `ddl-auto=validate` 성공
- 필요한 unique/foreign key/check 성격의 제약을 통합 테스트로 검증

### HTTP / Application

- 인증 실패, 인가 실패, validation 실패, version conflict를 구분 가능한 오류 계약으로 제공
- Entity를 직접 노출하지 않음
- UI와 향후 Agent가 동일 Application Capability 규칙을 사용 가능

### Project Gates

Milestone Full Gate:

`./gradlew check`

Final / Clean-environment Gate:

`./gradlew clean check`

각 Milestone의 completion evidence를 충족한 뒤 `./gradlew check`를 통과하면 다음 Milestone으로 진행한다.
최종 handoff 또는 clean-environment 검증에서는 `./gradlew clean check`를 실행한다.

DB 통합 테스트는 Testcontainers를 사용하며 Docker 사용 가능 환경에서 두 gate에 포함한다.

---

## 11. Implementation Dependencies

구현은 다음 의미 단위 순서를 기본으로 한다.

### Milestone 0 — Project foundation

- Spring Boot 프로젝트
- Gradle
- MySQL/Testcontainers
- Flyway
- 공통 오류 계약
- 기본 security skeleton
- 전체 test/check gate

### Milestone 1 — Identity and Authentication

- User/UserEmail
- PasswordCredential
- 이메일 인증/재설정
- Session
- Google ExternalIdentity
- 계정 생명주기

### Milestone 2 — Workspace

- Workspace
- Membership
- Invitation
- ADMIN/MEMBER 정책
- tenant isolation

### Milestone 3 — Document Authorization

- Document
- OPEN/RESTRICTED
- MANAGER/EDITOR/VIEWER
- AuthorizationPolicy
- 권한 실패 경로

### Milestone 4 — Setlist Core

- Setlist
- SetlistItem
- Workspace Song
- musical settings
- SongForm
- optimistic concurrency

### Milestone 5 — Score and Reference

- Object Storage adapter
- Score upload/reuse
- Reference URL
- YouTube search candidate 연결

### Milestone 6 — YouTube Integration

- OAuth Authorization
- Playlist create/update
- external failure/idempotency handling

### Milestone 7 — Export

- canonical snapshot
- PDF rendering
- immutable Export
- download

### Final Core Verification

Milestone 0~7 구현 완료 후 다음을 최종적으로 다시 검증한다.

- 전체 tenant isolation
- permission matrix
- lifecycle invariant
- race/concurrency
- OAuth/external failure
- migration
- end-to-end 핵심 흐름

각 Milestone은 이전 Milestone의 핵심 불변식과 해당 Milestone의 completion evidence가 검증된 후 진행한다.
검증이 통과하면 인간 승인 없이 다음 Milestone으로 진행한다.
Codex는 Locked 설계와 충돌하는 새로운 제품/보안 결정이 필요하거나, 외부 시스템 문제로 자체 진행이 불가능할 때만 질문한다.

현재 Core Backend 구현 범위는 Milestone 0~7이다.

## Post-Core Integration

Core Backend의 Milestone 0~7 및 Final Core Verification이 완료된 후 AI 개발자와 별도 통합 검토를 수행한다.

이 단계에서 다음을 확정한다.

- Agent Runtime
- Tool contract
- Conversation/context lifecycle
- approval protocol
- LLM provider
- 필요 시 Backend Capability 보완

### V1 이후 협업 편집 — 초안 보존과 충돌 해결 검토

2026-10-06 논의 기록. 아래는 후속 개발 시 검토할 방향이며, 현재 V1 구현 완료나 병합 정책·기술 선택 확정을 뜻하지 않는다. V1의 expectedVersion 검사와 CRDT/OT 비도입 정책은 유지한다.

- A와 B가 같은 버전을 열고 A가 먼저 저장하면 B의 오래된 저장은 거부한다. **저장 거부와 초안 삭제는 별개**이며, B의 입력을 유지하고 최신본으로 화면을 무조건 덮어쓰지 않는 UX를 준비한다.
- 권장 흐름: **초안 보존 → 현재 권한으로 최신본 조회 → 처음 열었던 원본·B의 초안·최신본 비교(3-way merge) → 안전한 병합 또는 사용자 선택 → 최신 expectedVersion으로 저장**. 재저장 시에도 권한·버전·도메인 불변식을 검사하며, 다시 충돌하면 같은 절차를 반복한다. 버전 번호만 바꿔 오래된 내용을 무조건 재전송하지 않는다.
- 독립적 변경 예: A가 첫 곡 Key, B가 둘째 곡 메모를 변경. 서로의 영향과 유효성을 확인할 수 있는 경우만 자동 병합 후보로 삼는다.
- 확인이 필요한 예: 같은 곡의 Key를 G/A로 각각 변경, A의 곡 삭제와 B의 해당 곡 송폼 수정, 양쪽의 곡 순서 변경. 코드 줄이 아니라 곡·필드·송폼 블록 단위로 차이를 보여주는 해결 화면을 검토한다.
- 현재 백엔드는 stale write를 409 VERSION_CONFLICT로 거부하지만, 초안 보존·구체적 차이 표시·자동 병합 UI는 아직 구현되지 않았다. 프론트/백엔드 협업 시 원본과 수정 내용을 어디에 보관할지, 새로고침·브라우저 종료 후 복구 범위, 보존 기간·권한 상실 시 처리, 자동 병합 허용 범위와 API 계약을 별도로 설계한다.
- 실시간 공동편집 단계에서는 CRDT/OT 등을 비교 검토한다. 기술적 수렴이 같은 Key 선택 등 사용자 의도와 업무 충돌까지 해결하는 것은 아니므로 권한 경계·삭제·순서·도메인 검증을 함께 설계한다. 현재 기술·배포 구조를 선제 도입하지 않는다.

Agent는 이 통합 이후에도 Core Backend Authorization을 우회하지 않는다.

Agent Runtime, LLM orchestration, conversation/context 처리, concrete approval protocol은 현재 Milestone 0~7 Codex 구현 범위가 아니다.
현재 Backend는 Application Capability와 Authorization 경계까지만 준비한다.

---

## 12. Design Lock

### Locked

다음은 Codex가 임의로 변경해서는 안 된다.

- V1 제품 범위와 비목표
- Workspace를 Tenant 경계로 사용하는 것
- WorkspaceRole `ADMIN / MEMBER`
- Primary Admin/Workspace Owner를 두지 않는 것
- DocumentRole `MANAGER / EDITOR / VIEWER`
- DocumentAccessPolicy `OPEN / RESTRICTED`
- ADMIN이 RESTRICTED Document를 우회하지 못하는 것
- DocumentGrant를 WorkspaceMembership에 귀속하는 것
- V1 DocumentType이 `SETLIST`인 것
- Song이 V1에서 Workspace-local인 것
- Score가 Workspace 내부 재사용 자원인 것
- Key/BPM/세션/메모/Score/Reference/SongForm을 SetlistItem 사용 맥락에 두는 것
- 외부 공유가 Export 파일을 통해서만 가능한 것
- PDF Export 생성/재시도는 EDITOR/MANAGER, 결과물 조회/다운로드는 현재 READ 권한인 것 (2026-10-01 사용자 명시 결정)
- Core Backend가 데이터/권한의 최종 권위자인 것
- Browser 인증이 server-side Session 기반인 것
- Google login identity와 YouTube authorization을 분리하는 것
- Agent가 DB에 직접 접근하지 않는 것
- V1에서 실시간 공동편집/Redis/Queue/Microservice/CRDT/범용 Billing/Rust worker를 도입하지 않는 것

### Intentionally Deferred

다음은 미완성 제품 정책이 아니라 담당 영역 또는 구현 세부사항으로 의도적으로 열어둔다.

- Agent Runtime 언어 및 framework
- LLM Provider
- Agent conversation/context/compaction 구현
- Agent approval protocol의 구체 저장/전달 방식
- 배포 Provider
- Object Storage Provider
- Email Provider
- Export renderer 구현체
- SongForm의 구체적인 물리 DB 표현
- V1 이후 실시간 공동편집 기술

위 항목은 Locked 정책을 위반하지 않는 범위에서 후속 결정할 수 있다.

### Human Decisions Remaining

현재 결정 상태는 [PROJECT.md의 Decisions Needed](PROJECT.md#decisions-needed)를 참조한다. Reference 교체, 단일 ADMIN/이전, 확인 후 유일 MANAGER 승계, 다수 구성원 공간 종료, 최소 종료 알림과 복구 미제공은 2026-10-07 사용자 승인으로 확정했다. 권한의 사람용 참고서는 [사용자 및 권한 정책](docs/review/core-backend-v1/user_authorization_policy.md)이며 이 Design과 동일 정책을 설명해야 한다. 개인정보 보존/삭제 등의 미결정은 PROJECT.md 한 곳에서 관리한다. 임시 PDF 배치는 최종 UI 승인과 구분한다. 기존 복수 ADMIN 데이터가 있다면 임의 ADMIN 선택/강등 없이 전환 전에 별도 해결한다.
