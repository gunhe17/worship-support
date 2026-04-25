# Tactical Design — "왜 필요했는가" 관점

---

## Entity — "이 객체가 같은 것인가?"

### 문제

```
사용자 이름이 "홍길동"인 두 객체가 있다.
같은 사람인가, 다른 사람인가?
```

단순히 필드 값이 같다고 "같은 객체"로 보면 안 되는 경우가 존재합니다.
예를 들어 **동명이인**, 혹은 **이름을 바꾼 사람**은 어떻게 처리할까요?

### 해결

> "시간이 지나도, 상태가 변해도 **추적이 필요한 것**은 Identity를 부여하라"

```
고객이 이름을 바꿔도 → 같은 고객
주문이 취소돼도     → 같은 주문
```

Identity가 없으면 **생명주기 추적 자체가 불가능**합니다.

---

## Value Object — "매번 새로 만들면 안 되나?"

### 문제

```java
// 이 둘은 같은가, 다른가?
Money a = new Money(1000, "KRW");
Money b = new Money(1000, "KRW");
```

`Money`에 ID를 부여하면 같은 금액인데도 다른 객체가 됩니다.
또한 금액 객체를 **공유**하면 한쪽이 바꿀 때 다른 쪽도 영향을 받습니다.

### 해결

> "Identity가 의미 없는 것은 **값 자체가 곧 정체성**이다"

- 불변으로 만들면 **공유해도 안전**
- 새로 만들어 교체하면 끝이라 **부수효과 없음**
- `equals`를 필드 기준으로 구현하면 **비교도 직관적**

```
1000원 == 1000원  → 당연히 같다
같은 배송지       → 당연히 같다
```

---

## Aggregate — "어디까지를 하나로 봐야 하나?"

### 문제

`Order`를 저장할 때 `OrderLine`도 같이 저장해야 하는가?
`OrderLine`을 직접 수정해도 되는가?

```
외부 코드가 OrderLine을 직접 수정
→ Order의 총금액이 맞지 않게 됨
→ 비즈니스 불변식(Invariant) 깨짐
```

여러 객체가 **일관성을 공유**하는데 각자 따로 수정될 수 있으면, 데이터 정합성을 보장할 방법이 없습니다.

### 해결

> "일관성을 함께 보장해야 하는 객체들을 **하나의 경계**로 묶어라"

```
Order (Root) 만 외부에 노출
    └── OrderLine 수정은 Order를 통해서만
         → Order가 불변식을 항상 검증 가능
```

Root 하나가 **트랜잭션 경계이자 수문장** 역할을 합니다.

---

## Domain Service — "이 로직은 어디에 두어야 하나?"

### 문제

계좌 이체 로직을 어디에 넣어야 할까요?

```
account.transfer(to, amount)   → from이 to를 알아야 함 (부자연스러움)
```

하나의 Entity에 넣으면 **다른 Entity를 알아야** 하는 강한 결합이 생깁니다.

### 해결

> "특정 객체에 속하지 않고 **여러 객체를 조율**하는 로직은 Service로 분리하라"

```java
transferService.transfer(from, to, amount);
// 두 Account를 외부에서 받아 조율
// 각 Account는 서로를 모름
```

단, Service가 너무 많아지면 **도메인 로직이 객체에서 빠져나가는** Anemic Domain Model이 됩니다. Service는 최후의 수단입니다.

---

## Repository — "저장소를 왜 추상화하나?"

### 문제

도메인 코드가 직접 SQL이나 JPA를 호출하면:

```java
// Domain 안에서
entityManager.persist(order);  // Infrastructure가 Domain을 침범
```

- DB를 바꾸면 **도메인 로직도 수정**해야 함
- 테스트할 때 **DB가 반드시 필요**해짐
- 도메인 로직과 영속성 로직이 **뒤섞임**

### 해결

> "Domain은 **Collection처럼** 사용하고, 실제 저장 방법은 관심 없게 하라"

```
Domain Layer  →  OrderRepository (Interface만 앎)
                       ↑ implements
Infrastructure  →  JpaOrderRepository
```

Domain은 저장소가 DB인지, 메모리인지 **알 필요가 없습니다.**

---

## Domain Event — "완료 사실을 어떻게 전파하나?"

### 문제

주문이 완료되면 알림, 포인트 적립, 재고 감소가 모두 일어나야 합니다.

```java
order.place();
notificationService.send(...);  // Order가 이 모든 걸 직접 알아야 함
pointService.accumulate(...);
inventoryService.decrease(...);
```

Order가 **관계없는 수많은 Service**를 알아야 하는 강결합이 생깁니다.

### 해결

> "**사실이 일어났다는 것만 발행**하고, 반응은 각자가 알아서 하게 하라"

```
Order → "OrderPlaced 발생했다"
          ├── NotificationHandler가 듣고 알림 처리
          ├── PointHandler가 듣고 포인트 처리
          └── InventoryHandler가 듣고 재고 처리
```

Order는 구독자를 **전혀 모릅니다.** 새로운 반응을 추가할 때 Order를 건드릴 필요가 없습니다.

---

## 전체 흐름 요약

| Building Block | 해결한 핵심 문제                      |
| -------------- | ------------------------------------- |
| Entity         | 시간이 지나도 "같은 것"임을 추적      |
| Value Object   | 동등성 판단 + 불변성으로 안전한 공유  |
| Aggregate      | 여러 객체 간 불변식(Invariant) 보장   |
| Domain Service | 특정 객체에 귀속되지 않는 로직의 위치 |
| Repository     | 도메인과 영속성 기술의 분리           |
| Domain Event   | 완료 사실 전파 시 결합도 제거         |

> 결국 모든 패턴은 **"도메인 로직을 순수하게 유지하면서 복잡성을 관리"** 하기 위한 수단입니다.
