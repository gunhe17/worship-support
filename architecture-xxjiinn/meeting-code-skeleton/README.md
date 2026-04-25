# Meeting Code Skeleton

이 디렉터리는 회의 설명과 초기 구현 출발점을 위한 최소 코드 골격이다.

- `app/core`: 전역 에러, 보안, 매핑
- `app/domains/auth`: auth 요청/응답, usecase, cookie 경계
- `app/domains/user`: user domain, repository 추상화, DB model 골격
- `app/domains/workspace`: workspace 생성/참여/멤버십 역할 골격
- `app/domains/project`: workspace 소유 project 골격

실제 구현 전 단계이므로 프레임워크 의존은 최소화하고, 책임 경계가 드러나는 수준까지만 둔다.
