# Architecture Guide

> Project CRUD 이후 모든 기능 구현의 기준이 되는 아키텍처 레퍼런스.
> 코드와 일치하지 않는 부분이 있으면 코드가 아닌 이 문서를 수정한다.

---

## 1. 기술 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.1.6 | SSR + Server Actions |
| UI 라이브러리 | React | 19.2.3 | `useActionState` 사용 |
| 스타일링 | Tailwind CSS | v4 | `@import "tailwindcss"` 방식 |
| 인터랙티브 UI | @headlessui/react | 2.2.9 | Dialog, Menu, Listbox, Switch |
| 인증/DB | Supabase | @supabase/ssr 0.8, supabase-js 2.96 | Postgres + Auth + Storage |
| 배포 | Vercel | — | Seoul 리전(icn1), Node.js 런타임 |
| 언어 | TypeScript | 5.x | strict 모드 |
| 패키지 매니저 | pnpm | — | — |

---

## 2. 디렉토리 구조 & 네이밍

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (폰트, ThemeToggle, <html>)
│   ├── page.tsx                # / → 인증 여부에 따라 /home 또는 /login redirect
│   ├── globals.css             # Tailwind 진입점
│   ├── (auth)/                 # 인증 관련 페이지 (공개)
│   │   ├── login/
│   │   │   ├── page.tsx        # 클라이언트 컴포넌트 (폼)
│   │   │   └── actions.ts      # Server Action
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (main)/                 # 인증 필요 페이지
│   │   ├── layout.tsx          # 헤더 + 인증 가드 (서버 컴포넌트)
│   │   ├── dashboard/
│   │   │   └── page.tsx        # /home redirect
│   │   ├── home/
│   │   │   ├── page.tsx
│   │   │   ├── home-header-text.tsx
│   │   │   └── home-project-list.tsx
│   │   └── projects/
│   │       ├── page.tsx
│   │       ├── actions.ts
│   │       ├── create-project-modal.tsx
│   │       ├── projects-list-utils.ts
│   │       ├── projects-table.tsx
│   │       ├── projects-table-sort-link.tsx
│   │       └── projects-table-pagination.tsx
│   ├── (editor)/
│   │   ├── layout.tsx
│   │   ├── templates/editor/page.tsx             # legacy redirect
│   │   └── project/[id]/template/[templateId]/editor/page.tsx
│   └── api/
│       └── auth/
│           ├── callback/route.ts   # OAuth/magic link 콜백
│           └── signout/route.ts    # POST 로그아웃
├── components/                 # 재사용 UI 컴포넌트 (22개)
│   ├── index.ts                # barrel export
│   ├── button.tsx
│   ├── ...
│   └── theme-toggle.tsx
├── lib/
│   ├── auth.ts                 # 인증 필수 페이지용 requireAuthenticatedUser
│   ├── audit.ts                # writeAuditLog 헬퍼
│   ├── auth-types.ts           # AuthFormState 타입
│   └── supabase/
│       ├── server.ts           # 서버용 Supabase 클라이언트
│       ├── client.ts           # 브라우저용 Supabase 클라이언트
│       └── middleware.ts       # 세션 갱신 + 인증 가드
├── types/
│   └── database.ts             # supabase gen types 결과 (placeholder)
└── proxy.ts                    # Next.js proxy 진입점 (인증 미들웨어 라우팅)
```

### 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 | kebab-case | `form-input.tsx`, `auth-types.ts` |
| 컴포넌트 | PascalCase | `FormInput`, `PageHeader` |
| Server Action 함수 | camelCase | `login`, `signup`, `createProject` |
| DB 테이블/컬럼 | snake_case | `block_song_list_item`, `created_at` |
| Route Handler | `route.ts` | `api/auth/signout/route.ts` |
| Server Action 파일 | `actions.ts` | `login/actions.ts` |
| 타입 파일 | `*-types.ts` 또는 `types/` 디렉토리 | `auth-types.ts` |

### 새 파일 위치 가이드

| 파일 종류 | 위치 |
|-----------|------|
| 페이지 (보호) | `src/app/(main)/<feature>/page.tsx` |
| 페이지 (공개) | `src/app/(auth)/<feature>/page.tsx` |
| Server Action | 같은 라우트 디렉토리의 `actions.ts` |
| Route Handler | `src/app/api/<domain>/<action>/route.ts` |
| UI 컴포넌트 | `src/components/<name>.tsx` + barrel export 추가 |
| 유틸리티/헬퍼 | `src/lib/<name>.ts` |
| 타입 정의 | `src/lib/<domain>-types.ts` 또는 `src/types/` |
| DB 마이그레이션 | `supabase/migrations/<timestamp>_<description>.sql` |

---

## 3. 요청 흐름

```
Browser
  │
  ▼
Next.js Proxy (src/proxy.ts)
  │
  ├── 정적 리소스 (_next/static, _next/image, favicon.ico, 이미지) → 바이패스
  │
  ├── 공개 경로 (/login, /signup, /forgot-password, /reset-password, /api/auth/callback)
  │   └── 세션 검증 없이 통과
  │
  └── 보호 경로 (그 외 전체)
      │
      ├── supabase.auth.getUser() → 유효 → supabaseResponse (세션 쿠키 갱신 포함)
      │
      └── 미인증 → redirect("/login")
          │
          ▼
      Page (Server Component)
          │
          ├── (main)/(editor) layout: requireAuthenticatedUser() 이중 검증
          │
          ├── Server Action (폼 mutation)
          │   └── createClient() → supabase 쿼리 → revalidatePath → redirect
          │
          └── Route Handler (비폼 작업)
              └── createClient() → supabase 쿼리 → NextResponse
```

### Server Action vs Route Handler

| | Server Action | Route Handler |
|---|---|---|
| 용도 | 폼 기반 데이터 mutation | 비폼 작업 (webhook, 파일 업로드, 외부 연동) |
| 호출 방식 | `<form action={formAction}>` | `fetch("/api/...")` |
| 파일 | `actions.ts` (`"use server"`) | `route.ts` |
| 예시 | login, signup, createProject | signout, callback, 이미지 업로드 |

---

## 4. Supabase 통합

### 3가지 클라이언트

| 클라이언트 | 파일 | 용도 | 생성 방식 |
|-----------|------|------|----------|
| **서버** | `src/lib/supabase/server.ts` | Server Action, Route Handler, Server Component | `createServerClient` + `cookies()` |
| **브라우저** | `src/lib/supabase/client.ts` | Client Component에서 realtime 등 | `createBrowserClient` |
| **미들웨어** | `src/lib/supabase/middleware.ts` | 세션 갱신 + 인증 가드 | `createServerClient` + request/response 쿠키 |

#### 서버 클라이언트 패턴

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출 시 무시 (middleware가 세션 갱신)
          }
        },
      },
    }
  );
}
```

### RLS 정책

- 모든 14개 테이블에 RLS 활성화
- `project.owner_id = auth.uid()` 기준으로 owner scope 적용
- `template/block/render` 및 block 하위 버전/조합 테이블은 project owner scope를 상속
- `audit_log`는 `actor_id = auth.uid()` 범위만 조회/변경 허용
- DELETE 정책 없음 → soft delete는 UPDATE로 처리

### 마이그레이션

- 위치: `supabase/migrations/`
- 네이밍: `<timestamp>_<description>.sql`
- 포함 항목: DDL + RLS 정책 + 트리거 + 인덱스
- 워크플로: 로컬 검증 → PR 리뷰 → 운영 적용

```bash
# 새 마이그레이션 생성
supabase migration new <description>

# 로컬 적용
supabase db reset

# 타입 생성
supabase gen types typescript --local > src/types/database.ts
```

---

## 5. 인증 & 세션

### 인증 플로우

| 기능 | 구현 방식 | 경로 |
|------|----------|------|
| 로그인 | Server Action (`signInWithPassword`) | `/login` |
| 회원가입 | Server Action (`signUp`) | `/signup` |
| 로그아웃 | Route Handler POST (`signOut`) | `/api/auth/signout` |
| 비밀번호 재설정 요청 | Server Action (`resetPasswordForEmail`) | `/forgot-password` |
| 비밀번호 재설정 완료 | Server Action (`updateUser`) | `/reset-password` |
| OAuth/링크 콜백 | Route Handler GET (`exchangeCodeForSession`) | `/api/auth/callback` |

### 경로 보호 (3중 구조)

1. **Proxy 인증 가드** (`src/proxy.ts` → `updateSession`):
   - 공개 경로 화이트리스트 체크 → 통과
   - 그 외: `getUser()` → 미인증이면 `/login` redirect
   - 세션 쿠키 자동 갱신

2. **레이아웃 가드** (`(main)/layout.tsx`, `(editor)/layout.tsx`):
   - `requireAuthenticatedUser()` 호출 → 미인증이면 `redirect("/login")`

3. **Server Action/Route Handler**:
   - `createClient()` → 쿠키 기반 세션으로 Supabase에 인증된 요청

### 공개 경로 목록

```typescript
const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/callback",
];
```

### Proxy matcher (제외 패턴)

```
/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

---

## 6. 데이터 접근 계층

### Soft Delete

모든 주요 엔티티(project, template, block, render)에 적용.

```sql
-- 공통 컬럼
deleted_at  TIMESTAMPTZ,  -- null이면 활성
deleted_by  UUID REFERENCES auth.users(id)
```

**규칙:**
- 삭제 = `UPDATE SET deleted_at = now(), deleted_by = <user_id>`
- 복구 = `UPDATE SET deleted_at = null, deleted_by = null`
- 기본 조회 = 항상 `.is("deleted_at", null)` 필터 적용
- 하위 리소스: project 삭제 시 template/block/render도 cascade soft delete

**쿼리 예시:**
```typescript
// 목록 조회 (soft delete 필터 필수)
const { data } = await supabase
  .from("project")
  .select("*")
  .is("deleted_at", null)
  .order("created_at", { ascending: false });

// soft delete
const { error } = await supabase
  .from("project")
  .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
  .eq("id", projectId);
```

### 버전 관리 (Block)

- 편집 저장: 항상 타입별 테이블에 **새 row insert**
- 현재 버전 지정: `block.current_version_id`를 새 버전 id로 update
- 되돌리기: 과거 버전 id를 `current_version_id`로 재지정 (버전 row 삭제 없음)

```typescript
// 버전 생성 + 현재 버전 지정 (트랜잭션 권장)
const { data: version } = await supabase
  .from("block_txt")
  .insert({ block_id: blockId, content: "새 내용" })
  .select()
  .single();

await supabase
  .from("block")
  .update({ current_version_id: version.id })
  .eq("id", blockId);
```

### Audit Log

```typescript
// src/lib/audit.ts
import { createClient } from "@/lib/supabase/server";

export async function writeAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  meta = {},
}: {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    meta,
  });
}
```

**호출 규칙: fire-and-forget**

```typescript
writeAuditLog({
  actorId: user.id,
  action: "project.create",
  entityType: "project",
  entityId: project.id,
  meta: { name: project.name },
}).catch(() => {});
```

- `.catch(() => {})` — audit 실패가 사용자 응답을 블로킹하지 않도록
- 모든 성공한 write 작업에 1건 이상 기록

### Audit Action 네이밍

```
auth.sign_in, auth.sign_up, auth.sign_out
project.create, project.update, project.soft_delete, project.restore
template.create, template.update, template.soft_delete, template.restore
block.create, block.update_meta, block.soft_delete, block.restore
block.version_create, block.set_current
render.create, render.update, render.delete
song_list.add_item, song_list.remove_item, song_list.reorder
advertisement.add_item, advertisement.remove_item, advertisement.reorder
```

### 페이지네이션 (권장)

```
?limit=50&offset=0
?q=검색어&type=...&includeDeleted=false
?orderBy=created_at&order=desc
```

---

## 7. UI 컴포넌트

### 컴포넌트 카탈로그

모든 컴포넌트는 `@/components`에서 barrel import.

```typescript
import { Button, FormInput, Alert, Dialog } from "@/components";
```

#### Primitives

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `Button` | button.tsx | 서버 | primary/secondary/ghost, sm/md/lg, href 시 `<a>` 렌더 |
| `Badge` | badge.tsx | 서버 | 8색 (gray/red/yellow/green/blue/indigo/purple/pink) |
| `Avatar` | avatar.tsx | 서버 | xs/sm/md/lg, src 없으면 `PersonIcon` fallback |
| `StatusIndicator` | status-indicator.tsx | 서버 | online/offline/away 도트 + 라벨 |

#### Feedback

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `Alert` | alert.tsx | 서버 | error/success 변형, message가 null이면 렌더 안 함 |
| `Toast` | toast.tsx | **클라이언트** | 우측 상단 토스트, 자동 닫힘 + 수동 닫기 지원 |

#### Form Elements

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `FormInput` | form-input.tsx | 서버 | label + input, HTMLInputAttributes 확장 |
| `FormTextarea` | form-textarea.tsx | 서버 | label + textarea |
| `FormSelect` | form-select.tsx | 서버 | native select + `ChevronDownIcon` |
| `FormCheckbox` | form-checkbox.tsx | 서버 | `CheckIcon`/`DividerHorizontalIcon`, label + description |
| `FormRadio` | form-radio.tsx | 서버 | label 포함 |
| `FileUpload` | file-upload.tsx | 서버 | dashed border drop zone |
| `SubmitButton` | submit-button.tsx | **클라이언트** | `useFormStatus` 기반 로딩 상태 |

#### Interactive (Headless UI)

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `Toggle` | toggle.tsx | **클라이언트** | Headless UI Switch |
| `Dropdown` | dropdown.tsx | **클라이언트** | Headless UI Menu, flat/grouped items |
| `Dialog` | dialog.tsx | **클라이언트** | Headless UI Dialog (centered modal) |
| `SlideOver` | dialog.tsx | **클라이언트** | Headless UI Dialog (right panel) |
| `Select` | select.tsx | **클라이언트** | Headless UI Listbox, avatar 지원 |

#### Layout

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `AuthLayout` | auth-layout.tsx | 서버 | 인증 페이지 래퍼 (title, subtitle, footer) |
| `AppTopBar` | app-top-bar.tsx | **클라이언트** | 공통 상단바 (좌측 슬롯 + 우측 액션 + 프로필 드롭다운) |
| `DescriptionList` | description-list.tsx | 서버 | key-value 3열 그리드 (term/detail) |
| `PageHeader` | page-header.tsx | 서버 | title + meta + actions |
| `StackedList` | stacked-list.tsx | 서버 | leading/trailing 리스트 |
| `EmptyState` | empty-state.tsx | 서버 | icon + title + description + actions |
| `TableEmptyState` | table-empty-state.tsx | 서버 | 테이블 비어 있음 상태 (아이콘 + 단문 텍스트, editor 패턴) |
| `WorkspaceSidebar` | workspace-sidebar.tsx | 서버 | 에디터 좌측 패널 공통 레이아웃 |
| `WorkspaceSidebarSection` | workspace-sidebar.tsx | 서버 | 에디터 패널 섹션 헤더 + 콘텐츠 래퍼 |
| `WorkspaceSidebarDivider` | workspace-sidebar.tsx | 서버 | 에디터 패널 구분선 |

#### Utility

| 컴포넌트 | 파일 | 서버/클라이언트 | 설명 |
|----------|------|----------------|------|
| `ThemeToggle` | theme-toggle.tsx | **클라이언트** | 다크/라이트 모드 토글 (fixed bottom-right) |

### 서버/클라이언트 컴포넌트 원칙

- **기본: Server Component** — `"use client"` 없으면 서버
- **`"use client"` 필요한 경우만**: `useState`, `useEffect`, `useActionState`, `useFormStatus`, Headless UI
- 클라이언트 컴포넌트는 파일 최상단에 `"use client"` 선언

### 폼 패턴

```

### 테이블 Empty 패턴

- editor에서 사용 중인 빈 상태 패턴을 표준으로 사용한다.
- 기본 형태: 중앙 정렬 + 아이콘(`FileTextIcon`) + 짧은 안내 문구 1줄
- 테이블형 화면(`projects`, `project/{id}` 하위 목록 등)은 `TableEmptyState`를 우선 사용한다.
Page (클라이언트)
├── useActionState(serverAction, initialState)
├── AuthLayout / 일반 레이아웃
└── <form action={formAction}>
    ├── Alert (에러)
    ├── Toast (성공)
    ├── FormInput (각 필드)
    └── SubmitButton (pendingText)
```

---

## 8. 스타일링

### Tailwind CSS v4 설정

```css
/* src/app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- `tailwind.config.ts` 없음 — v4는 CSS 기반 설정
- PostCSS 플러그인: `@tailwindcss/postcss`

### 다크모드

**방식:** class 기반 (`<html class="dark">`)

```typescript
// src/app/layout.tsx — FOUC 방지
<head>
  <script dangerouslySetInnerHTML={{
    __html: `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`,
  }} />
</head>
```

**패턴:** 항상 라이트 + 다크 쌍으로 작성

```
bg-white dark:bg-gray-900
text-gray-900 dark:text-white
text-gray-500 dark:text-gray-400
ring-gray-300 dark:ring-white/10
border-gray-200 dark:border-white/10
```

### 아이콘 정책

- 아이콘은 **`@radix-ui/react-icons`만 사용**한다.
- 커스텀 inline SVG, Heroicons, Lucide 아이콘은 신규 코드에 사용하지 않는다.
- 파일 예시:
  - 사용: `import { ArrowRightIcon } from "@radix-ui/react-icons";`
  - 금지: `<svg ...><path .../></svg>` 직접 삽입

### 컬러 팔레트

| 용도 | 라이트 | 다크 |
|------|--------|------|
| 배경 (페이지) | `bg-white` | `bg-gray-900` |
| 배경 (입력) | `bg-white` | `bg-white/5` |
| 배경 (카드) | `bg-white` | `bg-gray-800` |
| 텍스트 (primary) | `text-gray-900` | `text-white` |
| 텍스트 (secondary) | `text-gray-500` | `text-gray-400` |
| 텍스트 (placeholder) | `placeholder:text-gray-400` | `placeholder:text-gray-500` |
| 액센트 | `bg-indigo-600` | `bg-indigo-500` |
| 액센트 hover | `hover:bg-indigo-500` | `hover:bg-indigo-400` |
| 액센트 텍스트 | `text-indigo-600` | `text-indigo-400` |
| 보더/링 | `ring-gray-300` | `ring-white/10` |
| 에러 | `text-red-600 bg-red-50` | `text-red-400 bg-red-950` |
| 성공 | `text-green-600 bg-green-50` | `text-green-400 bg-green-950` |

### 반응형

- 기본: 모바일 → `sm:` 이상에서 확장
- 컨테이너: `mx-auto max-w-5xl px-6`
- 예시: `sm:mx-auto sm:w-full sm:max-w-sm`

### 타이포그래피 스케일 (편집 화면 제외)

- 페이지 섹션 제목: `text-lg font-semibold`
- 보조 설명: `text-sm/6`
- 테이블 헤더: `text-sm font-semibold`
- 테이블 본문: `text-sm`
- 페이지네이션/카운트 텍스트: `text-sm` (활성 숫자는 `font-semibold`)

### 레이아웃 간격 패턴 (중요)

- 동일한 역할의 섹션은 페이지가 달라도 **동일한 간격 클래스**를 사용한다.
- 기준 패턴:
  - 페이지 상단바 ↔ 본문: `mt-14`
  - 섹션 헤더 래퍼: `px-6 py-6`
  - 섹션 헤더(제목/설명) ↔ 테이블: **추가 `mb-*` 사용 금지**
  - 테이블 래퍼: `min-h-[260px]` + `overflow-x-auto`
  - 페이지네이션 래퍼: `px-6 pt-5 pb-3`
- 즉, 테이블형 화면에서 제목/설명 블록 뒤에는 바로 테이블이 와야 하며, 페이지별 임의 간격(`mb-4` 등)을 두지 않는다.

### 테이블 일관성 체크리스트

- 컬럼 구조는 데이터 유무와 관계없이 유지한다.
- empty 상태는 테이블 밖이 아니라 `tbody > tr > td(colSpan)` 내부에서 렌더링한다.
- 동일 도메인 화면(예: `projects`, `project/{id}`의 `templates`)은 헤더-테이블 간격을 동일하게 유지한다.
- 회귀 방지를 위해 `pnpm lint:ui-patterns`를 실행해 규칙 준수 여부를 확인한다.

---

## 9. 상태 관리

글로벌 상태 스토어 없음. 3가지 상태 유형으로 충분.

### 서버 상태

- Server Component에서 `await supabase.from(...).select()` 직접 호출
- 변경 후 `revalidatePath("/", "layout")` 로 캐시 무효화

### 폼 상태

```typescript
// src/lib/auth-types.ts
export interface AuthFormState {
  error: string | null;
  success: string | null;
}

// Page에서 사용
const initialState: AuthFormState = { error: null, success: null };
const [state, formAction] = useActionState(serverAction, initialState);
```

- 모든 Server Action은 `AuthFormState` (또는 동일 구조의 도메인별 FormState)를 반환
- `Alert` 컴포넌트는 에러 메시지 표시용으로 사용

### 피드백 메시지 정책

- **Editor 도메인(`(editor)` 및 template editor 내부 작업)을 제외한 데이터 생성/수정 성공 피드백은 `Toast`로 표시**한다.
- 성공 `Alert`는 신규 코드에서 사용하지 않는다.
- 삭제/복구처럼 즉시 이동(redirect)되는 동작은 기존 UX를 유지할 수 있다.
- 권장 패턴:
  - 에러: 폼 상단 `Alert`
  - 성공: `Toast` (우측 상단, 자동 닫힘)

### URL 상태

- 검색, 필터, 페이지네이션은 URL 쿼리 파라미터로 관리
- `useSearchParams()` (클라이언트) 또는 `searchParams` prop (서버 컴포넌트)으로 읽기

---

## 10. 에러 처리

### 계층별 전략

| 계층 | 처리 방식 |
|------|----------|
| **폼 검증** | Server Action에서 필수값/형식 체크 → `{ error: "메시지", success: null }` 반환 |
| **Supabase 에러** | `if (error)` 체크 → 사용자 친화적 메시지로 변환 → FormState 반환 |
| **인증 에러** | Proxy redirect → `/login`, Server Action에서 추가 검증 |
| **URL 에러** | `searchParams.get("error")` → `Alert` 컴포넌트로 표시 (Suspense 필요) |
| **audit 실패** | `.catch(() => {})` — 절대 사용자 응답 블로킹하지 않음 |

### Server Action 에러 패턴

```typescript
export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. 입력 검증
  const name = formData.get("name") as string;
  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요.", success: null };
  }

  // 2. 인증 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  // 3. DB 작업
  const { data, error } = await supabase
    .from("project")
    .insert({ name })
    .select()
    .single();

  if (error) {
    return { error: "프로젝트 생성에 실패했습니다.", success: null };
  }

  // 4. audit (fire-and-forget)
  writeAuditLog({
    actorId: user.id,
    action: "project.create",
    entityType: "project",
    entityId: data.id,
    meta: { name },
  }).catch(() => {});

  // 5. 성공 후 리다이렉트
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}
```

---

## 11. 구현 패턴 템플릿

Project CRUD 기준으로 복붙 가능한 패턴.

### 11-1. FormState 타입

> 현재 `src/lib/auth-types.ts`에 `AuthFormState`가 정의되어 있다.
> Project 구현 시 범용 `FormState`를 별도 파일로 생성하거나, `AuthFormState`를 `FormState`로 통합한다.

```typescript
// src/lib/form-types.ts (Project 구현 시 생성)
export interface FormState {
  error: string | null;
  success: string | null;
}
```

### 11-2. Server Action — 생성

```typescript
// src/app/(main)/projects/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { FormState } from "@/lib/form-types";

export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = formData.get("name") as string;
  if (!name || name.trim().length === 0) {
    return { error: "프로젝트 이름을 입력해주세요.", success: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("project")
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) {
    return { error: "프로젝트 생성에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.create",
    entityType: "project",
    entityId: data.id,
    meta: { name: data.name },
  }).catch(() => {});

  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}
```

### 11-3. Server Action — 수정

```typescript
export async function updateProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;

  if (!name || name.trim().length === 0) {
    return { error: "프로젝트 이름을 입력해주세요.", success: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { error } = await supabase
    .from("project")
    .update({ name: name.trim() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "프로젝트 수정에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.update",
    entityType: "project",
    entityId: id,
    meta: { name: name.trim() },
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { error: null, success: "프로젝트가 수정되었습니다." };
}
```

### 11-4. Server Action — Soft Delete / 복구

```typescript
export async function deleteProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { error } = await supabase
    .from("project")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "프로젝트 삭제에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.soft_delete",
    entityType: "project",
    entityId: id,
  }).catch(() => {});

  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function restoreProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { error } = await supabase
    .from("project")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) {
    return { error: "프로젝트 복구에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.restore",
    entityType: "project",
    entityId: id,
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { error: null, success: "프로젝트가 복구되었습니다." };
}
```

### 11-5. 목록 페이지 (Server Component)

```typescript
// src/app/(main)/projects/page.tsx
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StackedList, EmptyState, Button } from "@/components";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("project")
    .select("id, name, created_at, updated_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="프로젝트"
        actions={<Button href="/projects/new">새 프로젝트</Button>}
      />

      {projects && projects.length > 0 ? (
        <StackedList
          items={projects.map((p) => ({
            id: p.id,
            primary: p.name,
            secondary: new Date(p.created_at).toLocaleDateString("ko-KR"),
            href: `/projects/${p.id}`,
          }))}
        />
      ) : (
        <EmptyState
          title="프로젝트가 없습니다"
          description="새 프로젝트를 만들어 시작하세요."
          actions={<Button href="/projects/new">새 프로젝트</Button>}
        />
      )}
    </div>
  );
}
```

### 11-6. 생성 폼 (Client Component)

```typescript
// src/app/(main)/projects/new/page.tsx
"use client";

import { useActionState } from "react";
import { createProject } from "../actions";
import { FormInput, SubmitButton, Alert } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export default function NewProjectPage() {
  const [state, formAction] = useActionState(createProject, initialState);

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">
        새 프로젝트
      </h2>
      <form action={formAction} className="mt-8 space-y-6">
        <Alert message={state.error} variant="error" />
        <FormInput
          label="프로젝트 이름"
          id="name"
          name="name"
          type="text"
          required
          placeholder="예배 프로젝트"
        />
        <SubmitButton pendingText="생성 중...">프로젝트 생성</SubmitButton>
      </form>
    </div>
  );
}
```

### 11-7. 상세 페이지 (Server Component)

```typescript
// src/app/(main)/projects/[id]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, DescriptionList, Button } from "@/components";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("project")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        actions={
          <div className="flex gap-x-3">
            <Button href={`/projects/${id}/edit`} variant="secondary">
              수정
            </Button>
          </div>
        }
      />
      <DescriptionList
        items={[
          { term: "생성일", detail: new Date(project.created_at).toLocaleDateString("ko-KR") },
          { term: "수정일", detail: new Date(project.updated_at).toLocaleDateString("ko-KR") },
        ]}
      />
    </div>
  );
}
```

---

## 12. 배포 & 환경

### 환경변수

| 변수 | 용도 | 공개 |
|------|------|------|
| `APP_ENV` | 앱 실행 환경 선택 (`develop`/`production`) | X |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | O (클라이언트 노출) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | O (클라이언트 노출) |
| `NEXT_PUBLIC_SITE_URL` | 앱 기준 URL(콜백/링크) | O (클라이언트 노출) |

- `.env/.env.base` — `APP_ENV` 선택
- `.env/.env.develop` — 개발용 (로컬 Supabase)
- `.env/.env.production` — 운영용 (클라우드 Supabase)
- `.env/.env.*.example` — 템플릿 파일(커밋)
- Vercel 환경변수 — 프로덕션/프리뷰(동일 변수명)

### Vercel 설정

- 런타임: Node.js (Edge는 필요 시에만)
- 리전: Seoul (icn1)
- 프레임워크: Next.js (자동 감지)

### DB 마이그레이션 워크플로

```
1. supabase migration new <description>
2. SQL 작성 (DDL + RLS + 트리거 + 인덱스)
3. supabase db reset  (로컬 검증)
4. supabase gen types typescript --local > src/types/database.ts
5. PR → 코드 리뷰
6. supabase db push  (운영 반영)
```

### 로컬 개발

```bash
# 1. Supabase 로컬 스택
supabase start

# 2. 웹앱 실행
pnpm dev

# 3. 타입 생성
supabase gen types typescript --local > src/types/database.ts
```

---

## 부록: DB 스키마 요약

### 테이블 목록 (14개)

| 테이블 | 용도 | soft delete |
|--------|------|-------------|
| `audit_log` | 감사 로그 | X |
| `project` | 프로젝트(테넌트) | O |
| `template` | 템플릿(산출물 그릇) | O |
| `block` | 블록 메타 (type + current_version_id) | O |
| `render` | 템플릿↔블록 배치 (location, size) | O |
| `block_txt` | 텍스트 블록 버전 | X (버전 유지) |
| `block_image` | 이미지 블록 버전 | X |
| `block_datetime` | 날짜/시간 블록 버전 | X |
| `block_song` | 찬양 블록 버전 | X |
| `block_song_list` | 찬양 목록 블록 버전 | X |
| `block_advertisement` | 광고 블록 버전 | X |
| `block_background` | 배경 블록 버전 | X |
| `block_song_list_item` | 찬양 목록 구성 | X |
| `block_advertisement_item` | 광고 구성 | X |

### 공통 인프라

- **updated_at 트리거**: project, template, block, render에 자동 갱신
- **인덱스**: FK 컬럼 + `WHERE deleted_at IS NULL` 부분 인덱스
- **RLS**: owner scope(`project.owner_id = auth.uid()`) 기반 접근 제어
