# 사용자 및 권한 정책

> 대상: 예배 준비 지원 서비스 V1
>
> 목적: User, Workspace, Membership, Document, DocumentGrant, 서비스 탈퇴, Workspace 종료의 승인된 규칙과 상황별 결과를 설명한다.
>
> 원칙: 권한 판단은 항상 현재 DB 상태를 기준으로 하며, Session이나 클라이언트 상태만으로 권한을 확정하지 않는다.

**승인 정책·사례 참고서 · 2026-10-07.** 단일 ADMIN/이전, 확인 후 MANAGER 승계, 다수 구성원 공간 종료와 아래 보완 정책을 사용자가 승인했다. 정책 원본은 [PROJECT_DESIGN.md](../../../PROJECT_DESIGN.md), 현재 구현 상태·미결정은 [PROJECT.md](../../../PROJECT.md)다. 이 문서는 개별 테스트의 실행 증거를 대신하지 않는다. 정책 변경은 원본과 이 참고서를 함께 수정한다.

## 빠른 찾기

| 궁금한 상황 | 볼 곳 |
|---|---|
| 누가 읽고 수정하고 권한을 바꿀 수 있나? | [권한표](#26-한눈에-보는-권한표) |
| ADMIN을 넘기거나 MANAGER를 제거하려면? | 4·7장, [역할·책임 시나리오](#27-역할책임-변경-상황별-결과) |
| 공간/서비스에서 나가거나 재가입하면? | 8·16장, 27장 |
| 공간 종료 후 무엇을 볼 수 있나? | 9–14장, [접근·알림 사례](#28-접근인증알림-상황별-결과) |
| 동시에 요청하거나 실패하면? | 21장, [경쟁·실패 판정](#29-동시-요청실패의-판정-기준) |
| 기존 데이터와 실제 구현은 어떻게 전환하나? | [구현·전환 체크리스트](#30-구현전환-체크리스트) |

이 문서는 모든 요청 조합을 무한히 나열하는 대신 **행위자·공간·소속·문서 정책·Grant·버전·처리 시점**별 기준과 경계 사례를 담는다. 새 사례는 이 기준으로 판단하고, 기준만으로 정해지지 않는 제품 결정은 명시적으로 추가한다.

---

## 1. 핵심 개념

![공간 소속과 문서 권한을 분리하는 핵심 테이블 관계](assets/permission-model.svg)

### 1.1 User
서비스 사용자 계정이다.

하나의 User는 여러 Workspace에 참여할 수 있다.

서비스 회원탈퇴는 특정 Workspace에서 나가는 것과 다르며, User 계정 전체와 모든 Workspace 소속에 영향을 준다.

재가입한 사용자는 새로운 User로 취급하며, 과거 Membership이나 DocumentGrant를 자동 복원하지 않는다.

---

### 1.2 Workspace
공동 작업 공간이자 데이터 및 권한의 격리 경계다.

Workspace는 실제 교회 조직의 상하관계와 연결하지 않는다.

V1에서 Workspace Owner, Primary Admin 같은 별도 역할은 두지 않는다.

Workspace 상태는 다음과 같다.

- `ACTIVE`: 정상 사용 가능
- `TERMINATED`: 종료됨. 일반 사용자는 더 이상 접근하거나 재개할 수 없음

종료는 즉시 영구 삭제를 의미하지 않는다.

---

### 1.3 Membership
User가 특정 Workspace에 참여하는 관계다.

상태는 다음과 같다.

- `ACTIVE`: 현재 Workspace 구성원
- `ENDED`: Workspace에서 나갔거나 제거되었거나, Workspace 종료로 인해 소속이 종료됨

한 사용자가 과거에 어떤 Workspace에 속해 있었더라도, ENDED Membership은 다시 활성화하지 않는다.

재초대를 수락하면 항상 새로운 Membership을 생성한다.

과거 Membership과 연결된 DocumentGrant도 자동 복원하지 않는다.

---

### 1.4 Document
Workspace 내부 협업 리소스다.

V1의 핵심 DocumentType은 `SETLIST`이며, Setlist와 1:1로 연결된다.

Document 접근 정책은 `OPEN` 또는 `RESTRICTED`다.

---

### 1.5 DocumentGrant
특정 Document에 대한 권한이며, User가 아니라 `WorkspaceMembership`에 귀속된다.

역할은 다음과 같다.

- `MANAGER`: 조회, 수정, PDF Export 생성·재시도, 문서 권한 부여·변경·회수
- `EDITOR`: 조회, 수정, PDF Export 생성
- `VIEWER`: 조회

Document 생성자는 자동으로 MANAGER가 된다.

한 Document에 여러 MANAGER가 존재할 수 있다.

---

## 2. Workspace 역할 정책

### 2.1 ADMIN
V1에서는 Workspace마다 **ADMIN은 정확히 1명만 존재**한다.

Workspace 생성자가 최초 ADMIN이다.

ADMIN은 Workspace 운영 책임자이며 다음 권한을 가진다.

- MEMBER 초대
- MEMBER 제거
- Workspace 종료
- 필요한 경우 자신이 자동 승계한 Document의 MANAGER 권한 처리
- 후속 ADMIN 이전 기능을 통해 ADMIN 책임 이전

기존의 `MEMBER → ADMIN 승격` 방식은 사용하지 않는다.

ADMIN을 변경해야 할 경우에는 별도의 **ADMIN 이전**으로 처리한다.

ADMIN이 1명뿐이므로, 일반 탈퇴 전에 ADMIN 책임을 다른 ACTIVE MEMBER에게 이전해야 한다.

단, Workspace 자체를 종료하는 경우에는 ADMIN 이전 없이 종료 가능하다.

---

### 2.2 MEMBER
Workspace의 일반 구성원이다.

Workspace 소속만으로 모든 Document를 수정할 수 있는 것은 아니다.

실제 Document 권한은 Document 접근 정책과 DocumentGrant에 따라 결정된다.

---

## 3. Document 접근 정책

### 3.1 OPEN
현재 `ACTIVE Membership`을 가진 Workspace 구성원은 별도 Grant 없이 읽을 수 있다.

수정 및 관리에는 별도 Grant가 필요하다.

예:

- Grant 없음 + ACTIVE Membership → 읽기 가능
- VIEWER → 읽기 가능
- EDITOR → 읽기 + 수정 + Export
- MANAGER → 읽기 + 수정 + Export + 권한 관리

---

### 3.2 RESTRICTED
현재 `ACTIVE Membership`이며, 동시에 해당 Document의 유효한 DocumentGrant가 있어야 접근할 수 있다.

Workspace ADMIN이라고 해서 RESTRICTED Document를 자동으로 열람하거나 관리할 수 있는 것은 아니다.

단, **마지막 MANAGER 제거에 따른 자동 승계 상황은 예외**다.

이 예외에서는 ADMIN이 해당 Document의 MANAGER가 되며, 그 시점부터 해당 Document 접근권한을 가진다.

---

## 4. MANAGER 정책

### 4.1 복수 MANAGER
한 Document에는 여러 MANAGER가 존재할 수 있다.

복수 MANAGER는 정상 상태다.

---

### 4.2 마지막 MANAGER 보호
일반적인 문서 권한 변경에서는 마지막 MANAGER를 제거하거나 강등하여 MANAGER가 0명이 되는 상태를 만들지 않는다.

다만 Workspace ADMIN이 MEMBER를 Workspace에서 제거하는 경우에는 별도 승계 규칙을 적용한다.

---

### 4.3 유일 MANAGER인 MEMBER 제거
ADMIN은 MEMBER를 제거할 수 있으며, 해당 MEMBER가 어떤 Document의 유일 MANAGER라는 이유만으로 제거 자체를 차단하지 않는다.

대신 제거 전에 시스템은 해당 MEMBER가 유일 MANAGER인 Document를 계산한다.

유일 MANAGER Document가 존재하면 확인 화면에서 다음과 같이 안내한다.

> 이 사용자가 유일 MANAGER인 다음 문서들의 MANAGER 권한이 ADMIN 본인에게 이전됩니다.

ADMIN이 이를 확인한 경우에만 제거를 진행한다.

ADMIN에게 현재 접근권한 없는 문서는 제목·내용·개별 문서 식별 정보 없이 영향 문서 수만 안내한다. 확인 자체로 제한 문서를 열람할 수는 없다. 실제 승계가 확정된 뒤 MANAGER 권한으로 접근할 수 있다. 확인 후 권한·대상·영향 범위가 바뀌었다면 제거하지 않고 재확인을 요구한다.

처리 순서는 논리적으로 다음 결과를 보장해야 한다.

1. 영향을 받는 Document의 MANAGER 권한을 ADMIN에게 승계
2. 해당 MEMBER의 Membership을 ENDED 처리
3. 기존 DocumentGrant는 더 이상 사용 불가
4. Document 자체는 삭제하지 않음

승계, Membership 종료, 관련 알림 기록은 하나의 DB transaction에서 처리한다. 일부 승계만 남거나 제거만 성공하는 부분 처리는 허용하지 않는다.

---

### 4.4 이미 다른 MANAGER가 있는 경우
제거 대상 MEMBER가 MANAGER이더라도 해당 Document에 다른 MANAGER가 남는다면 ADMIN에게 자동 승계하지 않는다.

예:

- B, C가 모두 MANAGER
- ADMIN A가 B 제거
- C가 계속 MANAGER
- A에게 해당 Document 권한 자동 부여 없음

---

### 4.5 자동 승계 후 권한 정리
ADMIN이 유일 MANAGER 제거로 인해 자동 MANAGER가 된 이후 새 MANAGER를 추가할 수 있다.

새 MANAGER 추가 후에도 ADMIN의 MANAGER 권한을 자동 제거하지 않는다.

ADMIN이 더 이상 해당 Document 권한을 가질 필요가 없다면, 다른 MANAGER가 존재하는 것을 확인한 뒤 자신의 DocumentGrant를 직접 제거할 수 있다.

ADMIN을 자동으로 EDITOR로 낮추는 규칙은 두지 않는다.

이유는 Workspace와 Document마다 운영 방식이 다르기 때문이다.

---

## 5. MEMBER 초대 정책

ADMIN만 Workspace 구성원을 초대할 수 있다.

초대를 수락하면 `MEMBER` 역할의 새로운 ACTIVE Membership을 생성한다.

과거 동일 User가 해당 Workspace에 ENDED Membership을 가지고 있더라도 이를 재활성화하지 않는다.

항상 새로운 Membership을 생성한다.

초대 대상 이메일은 해당 User가 소유한 verified UserEmail인지 확인한다.

초대 토큰은 단일 사용, 만료, 해시 저장 원칙을 따른다.

---

## 6. MEMBER 제거 정책

ADMIN은 ACTIVE MEMBER를 제거할 수 있다.

문서 권한이 있다는 이유로 MEMBER 제거 자체를 차단하지 않는다.

단, 제거 대상이 유일 MANAGER인 Document가 있다면 4.3의 자동 승계 확인 절차를 거친다.

제거 완료 후:

- 해당 Membership → `ENDED`
- 해당 Membership에 연결된 DocumentGrant는 사용할 수 없음
- Document, Score, Reference, Setlist, Export 등 공동 데이터는 연쇄 삭제하지 않음
- 과거 작성자 표시는 필요 시 표시 이름 또는 탈퇴/비활성 상태 표현 정책에 따라 유지

---

## 7. ADMIN 이전 정책

Workspace에는 ADMIN이 1명만 존재한다.

따라서 기존 ADMIN이 Workspace를 떠나려면 다른 ACTIVE MEMBER에게 ADMIN을 이전해야 한다.

ADMIN 이전은 일반적인 MEMBER 승격과 구분한다.

ADMIN 이전 완료 후:

- 기존 ADMIN → MEMBER
- 대상 MEMBER → ADMIN
- Workspace에는 계속 ADMIN이 정확히 1명만 존재

대상은 같은 Workspace의 현재 ACTIVE MEMBER여야 하며, 자기 자신·ENDED 소속·다른 공간의 소속에는 이전할 수 없다. 대상의 수락은 요구하지 않는다. 이전과 서비스 내 알림 기록은 하나의 transaction에서 처리한다. DocumentGrant는 자동 변경하지 않으므로, 이전 후에도 기존 ADMIN이 유일 MANAGER라면 별도로 문서 책임을 이전해야 탈퇴할 수 있다.

V1에서 ADMIN이 장기 부재, 계정 접근 불가, 연락두절 등으로 정상 이전이 불가능한 특수 상황은 자동화된 복구 체계를 두지 않는다.

해당 상황은 운영 문의를 통해 수동 검토 대상으로 처리한다.

운영자 처리가 가능하다고 제품적으로 보장하지는 않는다.

---

## 8. Workspace 탈퇴 정책

### 8.1 일반 MEMBER 탈퇴
MEMBER는 Workspace에서 나갈 수 있다.

단, 어떤 Document의 유일 MANAGER라면 먼저 다른 ACTIVE 구성원에게 MANAGER를 부여해야 한다. 자발적 탈퇴에는 ADMIN 자동 승계를 적용하지 않는다. 다른 MANAGER가 남아 있다면 본인의 소속을 종료할 수 있다.

탈퇴 시 Membership은 ENDED가 된다.

해당 Membership의 DocumentGrant는 사용할 수 없다.

공동 Document와 자료는 삭제하지 않는다.

---

### 8.2 ADMIN 탈퇴
ADMIN은 Workspace에 유일한 ADMIN이므로, ACTIVE Workspace에서 그대로 탈퇴할 수 없다.

두 가지 선택지가 있다.

1. 다른 ACTIVE MEMBER에게 ADMIN 이전 후 탈퇴
2. Workspace 자체를 종료

ADMIN 이전 없이 ACTIVE Workspace만 남겨두고 ADMIN Membership을 종료하는 상태는 허용하지 않는다.

---

## 9. Workspace 종료 권한

기존의 “본인만 ACTIVE 구성원으로 남은 Workspace만 종료 가능” 규칙은 폐기한다.

최종 정책은 다음과 같다.

> **Workspace의 유일 ADMIN은 ACTIVE MEMBER 수와 관계없이 Workspace를 종료할 수 있다.**

따라서 구성원이 1명이든 10명이든 별도로 모두 제거한 뒤 종료할 필요가 없다.

Workspace 종료는 ADMIN의 단독 권한이다.

---

## 10. Workspace 종료 확인 화면

Workspace 종료는 구성원 전체와 공동 데이터 접근에 큰 영향을 주므로 일반 버튼보다 강한 확인 절차를 사용한다.

종료 직전 최소한 다음 정보를 표시한다.

- 현재 ACTIVE 구성원 수
- Document 수
- 진행 중 작업 존재 여부
- 종료 즉시 모든 구성원이 Workspace에 접근할 수 없게 된다는 안내
- 기존 자료가 즉시 영구 삭제되는 것은 아니라는 안내
- V1에서는 사용자가 직접 Workspace를 복구하거나 재개할 수 없다는 안내
- 복구가 보장되지 않는다는 안내
- 진행 중 외부 작업은 일부 이미 수행되었을 수 있다는 안내

최종 확인을 위해 ADMIN이 Workspace 이름을 다시 입력하도록 한다.

확인 화면은 실행 권한을 예약하지 않는다. 실행 직전에 현재 ADMIN·대상 공간·영향 범위를 다시 확인하고 달라졌다면 재확인을 요구한다. 종료는 DB commit 시 확정되며 별도의 TERMINATING 상태를 정책으로 추가하지 않는다.

개별 Document명이나 모든 DocumentGrant 관계를 종료 화면에서 전부 나열하지 않는다.

---

## 11. Workspace 종료 처리 결과

Workspace 종료가 확정되면 다음 상태 전이가 발생한다.

### 11.1 Workspace
`ACTIVE → TERMINATED`

### 11.2 Membership
해당 Workspace의 모든 `ACTIVE Membership → ENDED`

Membership 레코드는 삭제하지 않는다.

### 11.3 DocumentGrant
기존 Grant 레코드는 이력으로 유지할 수 있다.

단, ENDED Membership에 연결된 Grant는 어떠한 권한도 제공하지 않는다.

### 11.4 공동 데이터
Document, Setlist, Song, Score, Reference, Export 등 Workspace 내부 공동 데이터를 종료 즉시 영구 삭제하지 않는다.

“즉시 삭제하지 않음”은 “영구 보관”을 의미하지 않는다.

실제 보존 기간 및 삭제 정책은 별도 결정한다.

### 11.5 일반 사용자 접근
종료된 Workspace는 일반 Workspace 목록에서 제외한다.

기존 URL로 접근하면 Workspace 내용 대신 다음과 같은 최소 상태 정보만 제공한다.

> 종료된 Workspace입니다.

종료 전 구성원이었다는 이유만으로 Document, Score, Reference, 구성원 정보 등을 다시 보여주지 않는다.

일반 사용자는 TERMINATED Workspace를 재개할 수 없다.

---

## 12. Workspace 종료 알림

Workspace 종료 후 기존 ACTIVE 구성원에게 서비스 내 알림을 보낸다.

알림 목적은 갑작스러운 접근 차단을 계정 오류나 권한 버그로 오해하지 않게 하는 것이다.

이메일 알림은 V1 범위에서 제외한다.

수신자는 종료 직전 ACTIVE 구성원으로 고정한다. 종료와 소속 종료·알림 기록을 하나의 transaction에서 처리하며 DB 실패 시 전부 rollback한다. 소속이 ENDED가 되어도 본인 계정의 최소 종료 알림은 확인할 수 있다. 이 예외는 종료 알림/최소 상태에만 적용되고 문서·파일·구성원 목록 조회 권한을 주지 않는다. 무관한 사용자에게는 공간 존재/종료 여부를 공개하지 않는다. 서비스 회원탈퇴한 계정에는 로그인 접근을 허용하지 않는다.

---

## 13. 초대와 Workspace 종료

Workspace가 TERMINATED 되는 순간 미수락 초대는 모두 무효화한다.

종료 후에는 기존 초대 링크를 열더라도 Membership을 생성할 수 없다.

초대 수락과 Workspace 종료가 동시에 발생할 수 있으므로, Membership 생성 직전 또는 동일한 일관성 경계 안에서 Workspace 상태를 다시 검증한다.

TERMINATED Workspace에는 새로운 ACTIVE Membership이 생성되어서는 안 된다.

---

## 14. 진행 중 작업과 Workspace 종료

Workspace 종료 시 내부 작업과 외부 작업을 구분한다.

### 14.1 새로운 상태 변경 요청
Workspace 종료가 DB에 확정된 이후 해당 Workspace를 대상으로 하는 새로운 상태 변경 요청은 차단한다. 동시에 처리되는 요청은 현재 상태와 transaction 순서로 판정한다. 종료 버튼 클릭이나 확인 화면 표시 자체를 확정 시점으로 보지 않는다.

### 14.2 이미 진행 중인 내부 작업
PDF Export 저장 등 내부 상태를 최종 확정하기 전 Workspace 상태를 다시 확인한다.

이미 TERMINATED 상태라면 신규 내부 결과를 확정하지 않는다.

예:

- PDF 생성 시작
- 동시에 ADMIN이 Workspace 종료
- PDF 생성 완료 직전 Workspace 상태 재확인
- TERMINATED라면 신규 Export 레코드 확정 금지

### 14.3 외부 서비스 작업
YouTube Playlist 생성·수정처럼 외부 서비스에 이미 요청이 전달된 경우, 외부 side effect를 항상 되돌릴 수 있다고 보장하지 않는다.

따라서 정책은 다음과 같다.

- 내부 데이터 정합성을 우선 유지
- 종료 후 내부 상태 반영은 차단
- 이미 외부 서비스에서 처리된 작업의 완전한 롤백은 보장하지 않음
- 필요 시 사용자에게 외부 작업이 일부 반영되었을 가능성을 안내

---

## 15. Export 권한 및 성격

EDITOR와 MANAGER는 PDF Export를 생성할 수 있다.

Export는 특정 Document/Setlist version과 생성 당시 canonical content를 기준으로 동결된 immutable snapshot이다.

원본 Document를 이후 수정해도 기존 Export를 덮어쓰지 않는다.

Export 파일 자체를 Workspace 외부 사람에게 전달할 수 있다.

Export 파일을 전달받았다고 해서 Workspace 또는 Document 접근권한이 생기지는 않는다.

종료된 Workspace에서 기존 Export가 즉시 영구 삭제되는 것은 아니다.

Export 보존 기간과 실제 삭제 정책은 별도 결정한다.

---

## 16. 서비스 회원탈퇴

서비스 회원탈퇴는 특정 Workspace 탈퇴와 구분한다.

회원탈퇴는 User 계정 전체와 모든 Membership에 영향을 준다.

### 16.1 탈퇴 가능 조건
사용자가 ADMIN으로 남아 있는 ACTIVE Workspace가 있으면 일반 탈퇴할 수 없다.

먼저 각 Workspace에서 다음 중 하나를 수행해야 한다.

- 다른 ACTIVE MEMBER에게 ADMIN 이전 후 Workspace 탈퇴
- 해당 Workspace 종료

서비스 탈퇴는 일부 Workspace만 탈퇴되고 나머지는 남는 식의 부분 성공으로 처리하지 않는다.

모든 필수 책임 이전 또는 Workspace 종료 조건을 충족해야 전체 탈퇴를 진행한다.

ADMIN이 아니어도 활성 공간에서 유일 MANAGER라면 문서 책임 이전이 필요하다. 강제 MEMBER 제거에 적용하는 ADMIN 자동 승계를 서비스 탈퇴에는 적용하지 않는다. 서비스 탈퇴 요청이 공간 종료나 ADMIN 이전을 자동으로 수행하지 않는다.

### 16.2 공동 데이터
탈퇴 사용자가 만들었다는 이유로 공동 Document, Score, Reference, Setlist 등을 연쇄 삭제하지 않는다.

작성자 표시는 `탈퇴한 사용자` 등 개인정보 노출을 최소화하는 표현으로 대체할 수 있다.

### 16.3 재가입
재가입은 새로운 User다.

과거 Membership, DocumentGrant, ADMIN, MANAGER 권한을 자동 복원하지 않는다.

---

## 17. 표시 이름과 개인정보 노출

Workspace 구성원 간에는 표시 이름만 공유한다.

타인의 이메일 주소는 일반 구성원에게 공개하지 않는다.

ADMIN 또는 MANAGER 권한 지정에 대상자의 수락은 필요하지 않다.

ADMIN 이전 및 MANAGER 지정·승계 사실은 서비스 내 알림으로 통지한다(D-07의 지정 통지 범위).

위 지정 작업과 알림 기록은 DB에서 함께 처리한다. 알림 기록 실패 시 권한 변경도 rollback한다. 역할 지정 알림은 문서 제목·내용을 복사하지 않고 조회 시 현재 문서 접근권한을 다시 확인한다. 종료 알림만 12장의 한정된 ENDED 수신자 예외를 적용한다.

이메일 알림은 V1에서 제외한다.

---

## 18. 세션과 권한 검증

Browser Session에는 User 식별 중심 정보만 유지한다.

Workspace 역할이나 DocumentGrant를 장기 캐시하여 권한 근거로 사용하지 않는다.

모든 보호된 요청은 현재 DB의 다음 상태를 기준으로 권한을 다시 판단한다.

- WorkspaceStatus
- MembershipStatus
- Workspace 역할
- Document 접근 정책
- DocumentGrant
- optimistic version 등 필요한 동시성 조건

Workspace 또는 Membership 상태 변경은 열린 브라우저 세션보다 우선한다.

따라서 Workspace가 TERMINATED 되거나 Membership이 ENDED 되면 기존 로그인 세션이 남아 있어도 접근은 차단된다.

---

## 19. 주요 사용자 시나리오

### 시나리오 A — 혼자 만든 Workspace 종료
A가 Workspace를 만들고 혼자 사용 중이다.

A는 유일 ADMIN이다.

A는 즉시 Workspace 종료 절차를 진행할 수 있다.

종료 후 Workspace는 TERMINATED, A의 Membership은 ENDED가 된다.

---

### 시나리오 B — 여러 MEMBER가 활동 중인 Workspace 종료
A가 ADMIN이고 B~J가 MEMBER다.

A가 Workspace를 종료하기 위해 MEMBER를 한 명씩 제거할 필요는 없다.

A는 종료 확인 화면에서 영향 범위를 확인하고 Workspace를 직접 종료할 수 있다.

종료 시 모든 ACTIVE Membership은 ENDED가 된다.

---

### 시나리오 C — 유일 MANAGER인 MEMBER 제거
A는 ADMIN, B는 MEMBER다.

B가 Document X의 유일 MANAGER다.

A가 B를 제거하려 하면 시스템은 Document X가 영향을 받는다는 사실을 표시한다.

A가 확인하면 A에게 Document X의 MANAGER 권한을 먼저 승계한 뒤 B의 Membership을 ENDED 처리한다.

Document X는 유지된다.

---

### 시나리오 D — MANAGER가 여러 명인 경우 MEMBER 제거
B와 C가 Document X의 MANAGER다.

ADMIN A가 B를 제거한다.

C가 계속 MANAGER이므로 A는 Document X의 MANAGER로 자동 승계되지 않는다.

---

### 시나리오 E — 자동 승계 후 새 MANAGER 지정
A가 ADMIN이며 B 제거 과정에서 Document X의 MANAGER를 자동 승계했다.

이후 D가 새 담당자가 된다.

A는 D에게 MANAGER를 부여한다.

이 시점에는 A와 D가 모두 MANAGER일 수 있다.

A가 더 이상 필요하지 않으면 자신의 DocumentGrant를 직접 제거할 수 있다.

A를 자동으로 EDITOR로 바꾸거나 자동 제거하지 않는다.

---

### 시나리오 F — 일반 MEMBER 자발적 탈퇴
B가 Workspace를 자발적으로 떠난다.

B의 Membership은 ENDED가 된다.

B의 과거 Grant는 사용할 수 없다.

공동 자료는 유지한다.

---

### 시나리오 G — ADMIN이 Workspace를 떠나고 싶음
A가 유일 ADMIN이다.

Workspace를 계속 유지하려면 A는 ACTIVE MEMBER B에게 ADMIN을 이전한 뒤 탈퇴한다.

Workspace 자체가 더 이상 필요 없다면 A는 Workspace를 종료할 수 있다.

---

### 시나리오 H — 종료 직전 초대 수락
A가 B를 초대한 상태에서 Workspace 종료를 실행한다.

B가 동시에 초대 수락을 시도하더라도 최종 Membership 생성 전 Workspace 상태를 다시 확인한다.

Workspace가 TERMINATED라면 초대 수락은 실패해야 한다.

---

### 시나리오 I — 종료와 PDF 생성 경쟁
EDITOR B가 PDF Export를 생성 중이다.

ADMIN A가 Workspace를 종료한다.

PDF 생성 프로세스가 끝났더라도 결과 확정 직전에 Workspace 상태를 재확인한다.

TERMINATED이면 새로운 Export로 확정하지 않는다.

---

### 시나리오 J — 종료와 YouTube 작업 경쟁
사용자가 YouTube Playlist 변경을 요청했고 외부 API 호출이 이미 완료된 직후 Workspace가 종료될 수 있다.

내부 데이터는 종료 상태를 기준으로 추가 확정을 차단한다.

이미 외부 YouTube에서 적용된 변경까지 반드시 롤백된다고 보장하지 않는다.

---

### 시나리오 K — 종료된 Workspace의 기존 URL 접근
종료 전 MEMBER였던 B가 북마크한 URL로 다시 접근한다.

문서 내용은 보여주지 않는다.

자신의 로그인 계정으로 종료 당시 구성원임을 확인할 수 있는 사용자에게만 최소 상태 메시지를 제공한다. 무관한 사용자에게는 공간의 존재나 종료 여부를 공개하지 않는다.

> 종료된 Workspace입니다.

---

### 시나리오 L — 과거 MEMBER 재초대
B의 이전 Membership이 ENDED 상태다.

ADMIN이 B를 다시 초대하고 B가 수락한다.

새로운 Membership을 생성한다.

과거 DocumentGrant는 자동 복원하지 않는다.

---

## 20. 반드시 지켜야 할 불변식

다음 조건은 구현 및 테스트에서 항상 보장해야 한다.

1. ACTIVE Workspace에는 ADMIN이 정확히 1명 존재
2. ADMIN은 ACTIVE Membership에만 귀속
3. TERMINATED Workspace에는 ACTIVE Membership이 존재하지 않음
4. ENDED Membership은 어떠한 DocumentGrant도 사용할 수 없음
5. RESTRICTED Document는 ACTIVE Membership + 유효 Grant 없이는 접근 불가
6. 일반적인 Document 권한 변경으로 MANAGER 0명 상태를 만들지 않음
7. 유일 MANAGER MEMBER 제거 시 ADMIN 자동 승계와 Membership 종료가 일관되게 처리됨
8. 다른 MANAGER가 남는 경우 불필요한 ADMIN 자동 승계 없음
9. TERMINATED Workspace에는 새 Membership 생성 불가
10. 기존 Session, 기존 URL, 미수락 초대, 늦게 완료된 작업으로 Workspace 접근이 부활하지 않음
11. Workspace 종료 후 신규 내부 상태 변경 확정 금지
12. Workspace 종료와 공동 데이터 영구 삭제를 동일한 작업으로 취급하지 않음
13. 재가입 User와 과거 User의 권한 자동 연결 금지
14. 과거 ENDED Membership을 재활성화하지 않음
15. ADMIN 이전만으로 DocumentGrant를 변경하지 않음
16. 자발적 탈퇴/서비스 탈퇴의 유일 MANAGER에게 자동 승계를 적용하지 않음
17. 확인 후 변경된 영향 범위를 오래된 확인으로 승인하지 않음
18. 종료 알림의 예외로 공동 자료 접근권한을 되살리지 않음

---

## 21. 반드시 검증해야 할 경쟁·실패·악용 사례

### 권한 경쟁
- ADMIN 이전과 기존 ADMIN 탈퇴가 동시에 발생
- MEMBER 제거와 해당 MEMBER의 문서 수정이 동시에 발생
- MANAGER Grant 변경과 MEMBER 제거가 동시에 발생
- Workspace 종료와 ADMIN 이전이 동시에 발생

### 초대 경쟁
- 초대 수락과 Workspace 종료 동시 실행
- 동일 초대 토큰 중복 사용
- 종료 직전 재전송된 초대 링크 사용

### 작업 경쟁
- PDF Export 생성 중 Workspace 종료
- Score 업로드 중 Workspace 종료
- YouTube Playlist 변경 중 Workspace 종료
- 외부 API 성공 후 내부 DB 저장 전 Workspace 종료

### 세션 및 접근
- TERMINATED 직전 발급된 세션으로 재접근
- ENDED Membership 사용자가 열린 탭에서 수정 요청
- RESTRICTED Document URL 직접 접근
- 과거 Grant를 가진 새 Membership이 권한을 잘못 상속받는지 여부

### 승계
- 유일 MANAGER가 여러 Document를 가진 상태에서 MEMBER 제거
- 자동 승계 도중 일부 Document만 처리되고 제거되는 부분 실패
- 이미 ADMIN이 MANAGER인 Document와 그렇지 않은 Document 혼재
- 다른 MANAGER 존재 여부 계산 중 동시 Grant 변경

### 종료
- ACTIVE MEMBER 1명 / 다수 각각 종료
- 수십 개 Document가 있는 Workspace 종료
- 종료 요청 중 중복 클릭
- 종료 API 재시도
- 종료 후 일반 목록에서 완전히 제외되는지
- 종료 후 기존 URL에서 데이터가 새어나오지 않는지

---

## 22. V1에 구현할 것

- Workspace당 ADMIN 1명 정책
- ADMIN 이전 기능
- MEMBER 초대 및 제거
- 유일 MANAGER MEMBER 제거 시 영향 Document 계산
- 제거 확인 화면에서 MANAGER 승계 안내
- ADMIN에게 MANAGER 자동 승계
- Workspace 종료
- 종료 확인 화면
- Workspace 이름 재입력 확인
- WorkspaceStatus `ACTIVE / TERMINATED`
- 종료 시 모든 ACTIVE Membership → ENDED
- 종료 시 미수락 초대 무효화
- 종료 후 일반 접근 차단
- 종료 후 일반 Workspace 목록 제외
- 종료 후 서비스 내 알림
- 종료 이후 내부 작업 확정 방지
- 현재 DB 상태 기반 Authorization 재검증

---

## 23. V1에 구현하지 않을 것

- Workspace Owner / Primary Admin
- 복수 Workspace ADMIN
- 사용자용 Workspace 복구·재개 기능
- 복잡한 archive / restore lifecycle
- Workspace hard delete UI
- 운영자 복구 보장 기능
- ADMIN 장기 부재에 대한 자동 승계
- 이메일 기반 Workspace 종료 알림
- 외부 서비스 side effect의 완전 자동 롤백 보장
- 실시간 공동편집용 CRDT/OT

---

## 24. 아직 미결정인 보존·삭제 정책

다음 항목은 본 문서의 권한 정책과 분리하여 출시 전에 결정해야 한다.

- Workspace 종료 후 데이터 종류별 보존 기간
- 보존 기간 시작 시점
- User 탈퇴 후 개인정보 삭제 또는 익명화 기준
- 표시 이름, 작성자 정보, 감사 이력 처리
- Score 원본 파일 보존 기간
- 생성된 PDF Export 보존 기간
- Object Storage 파일 삭제 시점
- 감사 로그 보존 기간
- 백업 데이터 삭제 주기
- 운영자가 실제 삭제를 수행하는 절차
- 법적 보존 의무 여부

`즉시 삭제하지 않음`은 `영구 보관`을 의미하지 않는다.

법적 판단이 필요한 경우 실제 운영 국가, 법인 형태, 개인정보 처리 구조를 기준으로 별도 검토해야 한다.

---

## 25. 최종 정책 요약

이 서비스의 권한 모델은 다음 원칙으로 요약된다.

> Workspace에는 하나의 ADMIN만 존재하며, ADMIN은 구성원 관리와 Workspace 종료에 대한 최종 운영 권한을 가진다. Document 권한은 Workspace 권한과 분리하며, RESTRICTED Document는 명시적 Grant가 없으면 ADMIN도 자동 접근할 수 없다. 다만 유일 MANAGER인 MEMBER를 제거하는 경우에는 공동 데이터의 관리 공백을 막기 위해 ADMIN이 해당 Document의 MANAGER를 명시적 확인 후 승계한다. Workspace 종료는 구성원 수와 관계없이 ADMIN이 실행할 수 있으며, 종료 즉시 모든 Membership을 ENDED 처리하고 접근을 차단하되 공동 데이터를 즉시 영구 삭제하지 않는다. 종료와 데이터 삭제, 복구, 개인정보 보존은 서로 다른 정책으로 관리한다.

## 26. 한눈에 보는 권한표

전제: 로그인한 유효한 User, ACTIVE Workspace, 그 공간의 ACTIVE Membership. 다른 Workspace의 ID나 과거 소속으로는 아래 권한을 얻을 수 없다.

| 문서에서의 역할 | OPEN 읽기 | RESTRICTED 읽기 | 수정·선택 교체 | PDF 생성·재시도 | PDF 조회·다운로드 | Grant·접근 정책 변경 |
|---|---|---|---|---|---|---|
| Grant 없음 | 가능 | 불가 | 불가 | 불가 | OPEN만 가능 | 불가 |
| VIEWER | 가능 | 가능 | 불가 | 불가 | 가능 | 불가 |
| EDITOR | 가능 | 가능 | 가능 | 가능 | 가능 | 불가 |
| MANAGER | 가능 | 가능 | 가능 | 가능 | 가능 | 가능 |

ADMIN도 위 표를 그대로 적용한다. PDF가 불변이라는 뜻은 과거 권한으로 계속 다운로드할 수 있다는 뜻이 아니다. 다운로드 시 현재 문서 읽기 권한이 필요하다.

| Workspace 작업 | ADMIN | MEMBER |
|---|---|---|
| 구성원 초대·취소·재전송 | 가능 | 불가 |
| MEMBER 강제 제거 | 확인·필요한 승계 후 가능 | 불가 |
| ADMIN 이전 | 같은 공간 ACTIVE MEMBER에게 가능 | 불가 |
| Workspace 종료 | 영향 확인·이름 재입력 후 가능 | 불가 |
| 자발적 공간 탈퇴 | ADMIN 이전 또는 공간 종료 필요; 문서 책임도 확인 | 유일 MANAGER가 아니면 가능 |

## 27. 역할·책임 변경 상황별 결과

| 상황 | 처리 결과 |
|---|---|
| ADMIN A가 B에게 ADMIN 이전 | A는 MEMBER, B는 ADMIN. 문서 권한은 그대로 |
| 이전 대상이 다른 공간/ENDED Membership/본인 | 거부. 기존 ADMIN 유지 |
| A가 ADMIN을 이전했지만 여전히 유일 MANAGER | 공간 유지 중 탈퇴 거부. 문서 책임도 먼저 이전 |
| B가 유일 MANAGER인 문서를 여러 개 가짐; ADMIN이 B 제거 | 전체 영향 확인 후 필요한 모든 문서 승계와 제거를 함께 처리 |
| B 외에도 ACTIVE MANAGER C가 있음 | B 제거 가능. 해당 문서는 A에게 승계하지 않음 |
| C의 Grant가 MANAGER지만 C의 소속은 ENDED | 남은 MANAGER로 계산하지 않음 |
| A가 기존 VIEWER/EDITOR인 문서의 유일 MANAGER B 제거 | 확인 후 A를 MANAGER로 변경하고 B 소속 종료 |
| B가 유일 MANAGER인 상태에서 스스로 공간/서비스 탈퇴 | 거부. 자동 승계 없이 먼저 책임 이전 |
| 일반 Grant 변경으로 마지막 MANAGER 삭제/강등 | 거부. ADMIN 강제 제거 예외와 다름 |
| MANAGER A가 C를 추가한 뒤 자신의 Grant 회수 | 다른 ACTIVE MANAGER가 남으면 가능 |
| ADMIN이 아닌 MANAGER가 다른 사람의 Workspace 소속 제거 | 불가. 문서 관리권한은 구성원 제거권한이 아님 |
| 회원탈퇴할 User가 여러 공간에 참여, 한 공간에 책임이 남음 | 전체 탈퇴 거부. 다른 공간의 소속도 변경하지 않음 |
| ENDED Membership이 있던 User를 재초대 | 새 Membership 생성. 과거 Grant를 복사하지 않음 |
| 탈퇴 후 같은 이메일로 재가입 | 새 User. 이메일 일치만으로 과거 소속/권한 복원 안 함 |

## 28. 접근·인증·알림 상황별 결과

| 상황 | 처리 결과 |
|---|---|
| 로그인하지 않음/Session 만료/탈퇴 계정 | 인증 거부. 과거 Grant로 우회 불가 |
| 로그인했지만 다른 공간의 문서 ID 입력 | tenant 경계에서 차단. 내용·역할 공개 안 함 |
| OPEN에서 RESTRICTED로 변경, B에게 Grant 없음 | 이후 권한 검사에서 읽기 거부. 열린 화면은 권한 근거 아님 |
| EDITOR가 VIEWER로 바뀐 뒤 저장/PDF 생성 | 거부. 현재 읽기 권한이 있으면 읽기만 가능 |
| MANAGER Grant가 있어도 Membership은 ENDED | 문서 접근 불가 |
| 이전 가입·다른 공간의 Membership ID로 Grant 지정 | 거부. 같은 공간 ACTIVE 소속에만 지정 |
| 제거 확인 중 접근권한 없는 RESTRICTED 문서가 있음 | 영향 수만 안내. 승계 commit 후에만 문서 열람 가능 |
| 종료 당시 구성원이 종료 알림 조회 | 본인 계정의 최소 안내만 허용. 자료/구성원은 불가 |
| 종료 당시 구성원이 아니었던 사용자가 종료 URL 접근 | 공간 존재/종료 여부 비공개 |
| 종료된 공간의 초대 링크 사용 | 수락 불가. 새 ACTIVE 소속 생성 안 함 |
| 종료 전 내려받은 PDF를 보관/다른 사람에게 전달 | Backend가 회수할 수 없음. 수신자에게 서비스 접근권한은 생기지 않음 |
| 권한 알림을 받은 뒤 해당 문서 권한 회수 | 알림은 권한 증명이 아님. 문서 정보 조회 시 현재 접근 검사 |
| Workspace 종료 뒤 다른 Workspace 사용 | 다른 공간의 권한은 영향 없음. 서비스 계정 탈퇴와 다름 |

Session은 로그인한 사람이 누구인지 확인하는 수단이다. 클라이언트가 보낸 userId·role이나 자연어 요청의 주장만으로 Actor를 신뢰하지 않는다. Actor는 인증된 User를 기반으로 Backend가 판정하며, 미래 AI 호출도 같은 Backend 권한 경계를 거쳐야 한다. 브라우저 상태 변경 요청에는 CSRF 보호를 적용한다. 이 문서는 구체 Agent 승인 프로토콜을 정하지 않는다.

## 29. 동시 요청·실패의 판정 기준

| 경쟁·실패 | 반드시 보장할 결과 |
|---|---|
| ADMIN 이전 두 요청이 동시에 실행 | 현재 ADMIN 검사와 직렬화로 정확히 한 명 유지. 오래된 ADMIN 권한으로 두 번째 이전 불가 |
| 확인 후 MANAGER/구성원/진행 작업 등 영향 범위 변경 | 현재 범위 재검사. 달라졌으면 재확인 요구 |
| 승계 중 DB/알림 기록 실패 | Grant·Membership·알림 전부 rollback |
| 종료와 초대 수락 경쟁 | 수락이 먼저 확정되면 그 구성원도 종료 영향에 포함. 종료가 먼저 확정되면 수락 거부. 확인 범위가 달라졌다면 종료 재확인 |
| 종료와 수정 경쟁 | 수정이 먼저 확정되면 종료 전 변경으로 남음. 종료가 먼저 확정되면 수정 확정 금지 |
| 제거/권한 회수와 수정 경쟁 | 현재 인가와 변경을 같은 보호된 transaction에서 판정. 변경 확정 뒤에는 과거 권한 사용 불가 |
| A와 B가 같은 버전을 수정, A가 먼저 저장 | B는 version conflict. A 결과 유지. 권한 검사 실패와 버전 충돌을 구분 |
| B의 저장이 conflict로 거부됨 | 프론트는 화면 초안을 유지. 버전만 바꾸어 자동 덮어쓰기 금지 |
| 파일 읽기 중 소속 종료/서비스 탈퇴 확정 | 외부 I/O 후 현재 인가 재검사. 이미 전달한 bytes의 회수는 보장 안 함 |
| 종료 중 PDF 렌더링/Score 업로드/외부 명령 실행 | 종료 후 새 정상 결과 확정 금지. 실패·보상은 관찰 가능하게 기록 |
| 외부 작업 성공, 내부 확정 전에 종료 | 외부 완전 rollback 미보장. 내부 정상 성공 확정은 차단 |
| 종료/제거/이전 중복 요청·응답 유실 후 재시도 | 중복 승계·권한 이전·정상 결과 생성으로 이어지지 않음. 현재 상태 기준 결과 처리; 정확한 HTTP 계약은 구현/검증에서 고정 |

DB transaction은 DB 변경의 원자성을 보장하는 수단이지 브라우저 표시·네트워크 전송·Object Storage·YouTube까지 하나로 commit하는 수단은 아니다. 외부 I/O 동안 장기 DB transaction을 유지하지 않고 확정 전 현재 상태를 재검사한다.

## 30. 구현·전환 체크리스트

| 항목 | 현재 의미/필요한 증거 |
|---|---|
| 기존 인증·tenant·Grant·expectedVersion | 기존 구현 존재. 새 정책 반영 후에도 거부·경합·rollback 회귀 필요 |
| 단일 ADMIN/이전·확인 후 승계·공간 종료·알림 | 정책 확정. 이 문서만으로 구현 완료 아님 |
| 기존 복수 ADMIN 데이터 | 자동으로 한 명 선택/강등하지 않음. 전환 전 대상 확인 및 별도 해결. 운영 DB 작업 자동 실행 금지 |
| 새 스키마 | 새 Flyway migration 사용. 이미 적용된 migration 재작성 금지 |
| 권한·확인·알림 API | Backend 검증뿐 아니라 프론트 확인/초안 보존 흐름은 별도 인계·통합 검증 |
| 역할표 전체 조합 | 허용 테스트 외에 거부 시 DB·외부 무변경도 확인 |
| 종료 상태 조회·알림 | ENDED 예외를 최소 상태/본인 알림에만 한정하고 타 tenant/타인 노출 거부 |
| 운영자 문의·복구 | 문의나 수동 검토 가능성은 복구 성공/권한 우회 도구 제공의 보장이 아님 |
| 보존·삭제 | 24장 미결정. 임의 기간·자동 영구 삭제 구현 금지 |

구현 완료 여부는 PROJECT와 ExecPlan의 실제 증거를 기준으로 갱신한다. 새 시나리오가 위 표에 없더라도 tenant·현재 소속·문서 Grant·책임자·버전·종료 경계를 모두 적용한다. 새로운 예외가 필요하면 정책 변경으로 검토하며 코드에서 조용히 허용하지 않는다.
