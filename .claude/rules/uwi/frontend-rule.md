---
paths:
  - "worship_support/uwi/**"
---

# 프런트엔드 규칙

적용 범위: `worship_support/uwi/` 의 Next 앱 전체(`bin/` 옛 화면과 `design/` 랩은 제외). 주석과 커밋 메시지는 [global-convention](../global-convention.md), 색과 글꼴과 여백의 근거는 [design-rule](design-rule.md) 을 따른다.

## 이 문서

| 섹션 | 핵심 |
|---|---|
| **구성** | Next.js App Router 서버가 별도 컨테이너로 돌고, `/api` 를 compose 네트워크의 `api` 서비스로 넘긴다 |
| **폴더와 계층** | `app` → `features` → `ui` → `lib` 한 방향으로만 가져온다 |
| **공용 부품** | 버튼, 행, 접기, 메뉴, 모달 같은 모양은 `ui/` 의 부품으로만 그린다 |
| **스타일** | Tailwind 클래스와 `globals.css` 토큰만. 새 색과 새 반경을 만들지 않는다 |
| **반응형** | 1024 미만은 사이드바 덮개, 768 미만은 한 열과 탭 줄, 640 미만은 설정 전체 화면 |
| **상태와 데이터** | 화면 상태는 컴포넌트 안에, fetch 는 `lib/api.ts` 에서만 |
| **이름** | 파일 하나에 컴포넌트 하나, 이름은 파일 이름과 같다 |
| **검증** | `npm run build` 와 `check/` 의 화면 점검 |

---

## 구성

| 항목 | 정한 것 |
|---|---|
| 프레임워크 | Next.js App Router, React, TypeScript strict |
| 실행 | `next build` 의 `output: "standalone"` 을 `node server.js` 로 띄운다. compose 의 `uwi` 서비스 |
| 경로 | 화면은 `/`(홈), `/collected`(작업대) 둘. 식별자는 경로가 아니라 쿼리(`?id=` `?doc=`)로 받는다 |
| API | Python `api` 서비스의 `/api/*` 를 그대로 쓴다. `next.config.ts` 의 rewrites 가 `/api/*` 를 `API_URL` 로 넘긴다. compose 안에서는 `http://api:8765`, 로컬 개발은 `http://127.0.0.1:28300`. Next 의 Route Handler, Server Action 을 쓰지 않는다 |
| 네트워크 | 브라우저는 uwi 하나만 본다. uwi 와 api 는 compose 기본 네트워크에서 서비스 이름으로 만난다 |
| 스타일 | Tailwind v4. 토큰은 `app/globals.css` 의 `@theme` 한 곳 |
| 의존성 | `next` `react` `react-dom` `marked` `katex` 뿐. 상태 관리, 데이터 패칭, UI 킷, 아이콘, 차트 라이브러리를 들이지 않는다 |

모든 화면 컴포넌트는 브라우저에서만 돈다(`"use client"`). 쿼리를 읽는 페이지는 `<Suspense>` 로 감싼다.

## 폴더와 계층

```
uwi/
  app/                    라우트. 페이지는 feature 컴포넌트 하나를 감싸기만 한다
    layout.tsx            Shell(헤더, 사이드바, 설정 모달, 토스트)
    page.tsx              홈
    collected/page.tsx    작업대
    globals.css           토큰, 전역 글자 스타일(prose), 애니메이션
  features/<이름>/         한 화면 영역의 컴포넌트 묶음
  ui/                     어디서나 쓰는 모양 부품
  lib/                    React 가 없는 함수(api, cx, storage, time, markdown, math, expression, graph, visual, events, collect, items, zoom, number)
  check/                  화면 점검 스크립트(smoke, workbench, chat, flows, panes, settings, search, collect, persist, auth, library, mobile, delete, trash, visual, create, loading, motion)
  design/                 디자인 랩. 앱이 가져오지 않는다
```

가져오기는 한 방향이다.

| 어디서 | 가져올 수 있는 것 |
|---|---|
| `app/` | `features/` `ui/` `lib/` |
| `features/<a>/` | 같은 feature, 다른 feature 의 컴포넌트 파일, `ui/`, `lib/` |
| `ui/` | `ui/` `lib/` |
| `lib/` | `lib/` |

`ui/` 는 어떤 feature 도 모른다. 특정 화면에서만 쓰는 모양이면 그 feature 안에 둔다. 두 번째 feature 가 쓰게 되면 그때 `ui/` 로 올린다.

| feature | 맡는 것 |
|---|---|
| `shell` | 헤더, 로그인 화면, 사이드바(Home, Agent 대화 목록, Collected 문서 트리, Space 트리, 각 검색), 사이드바 폭 조절 |
| `home` | 홈 입력창, ask/collect 모드, 백그라운드 수집 작업의 진행 표시 |
| `workbench` | 그룹(최대 4), 좌우 분할, 드롭 구역, 패널 틀(`Pane` `Body`)과 패널 바, 작업대 Context |
| `chat` | 대화 패널, 질문과 답변(모델 답변, 수집 카드), 입력창(명령어, 제공사·모델), 인용, 주석 |
| `doc` | 문서 패널, 언어 전환, 내려받기, 선택 막대 |
| `material` | 자료 패널 |
| `blocks` | 답변·수업 블록 렌더러, 수식(KaTeX), 그림 블록(plot bar vectors heatmap scatter tokens table graph), 그래프 실험(Playground) |
| `settings` | 설정 모달(General·Font·Trash, Account·Profile·Users(관리자만), Models·제공사, Agent·Function), 요금제 로그인 시트 |

## 공용 부품

같은 모양은 같은 부품으로 그린다. 화면에서 `rounded-full border ...` 같은 버튼 클래스를 직접 조합하지 않는다.

| 부품 | 모양 | 쓰는 곳 |
|---|---|---|
| `Button tone="fill"` | 파란 채움 알약 | 그 화면의 주 동작 하나(Log in, Save, Submit) |
| `Button tone="line"` | 파란 윤곽 알약 | 섹션 동작(+ Plan login, + API key), 그래프 도구 |
| `Button tone="quiet"` | 회색 바탕 알약 | 보조 동작(Cancel, Log out, Remove, Default) |
| `Button tone="link"` | 파란 글자 | 문장 안의 동작(이 답변에 질문하기, 고치기) |
| `IconButton` | 28px 사각, 올리면 회색 | 헤더 아이콘(사이드바, 설정), 모달 닫기 |
| `IconButton size="sm"` | 22px 사각 | 패널 바(내려받기, 닫기) |
| `MenuButton` | 회색 글자 + ⌄, 누르면 `Menu` | 홈 모드(ask ⌄), 제공사·모델 선택. 바깥을 누르면 닫힌다 |
| `InputBar` `SendButton` | 흰 둥근 입력 틀, 파란 원형 보내기 | 홈 입력창, 대화 입력창 |
| `Segmented` | 회색 바탕 안의 흰 선택 | 언어, 형식, 홈 모드 |
| `Switch` | 초록 켜짐 | 켜기/끄기 하나 |
| `Dot` | 6px 점, 초록 또는 회색 | 상태 |
| `SectionHeader` | 13px 대문자 회색 제목, 개수, 오른쪽 동작 | 모든 섹션 머리 |
| `TreeRow` `Chevron` `Fold` | 사이드바의 줄, 회전 화살표, 접기 애니메이션 | 사이드바 트리, 설정의 수단 목록 |
| `Menu` `MenuItem` | 흰 바탕, 얇은 테두리, 그림자 없음 | 드롭다운, 명령어, 모델 선택 |
| `Modal` | 어두운 배경 위 흰 패널, Esc 와 바깥 클릭으로 닫힘. `open` 으로 열고 닫는다 | 설정 |
| `Popup` | 모달 위에 한 번 더 뜨는 작은 확인 창. Esc 는 이 창만 닫는다. `open` 으로 열고 닫는다 | 사용자 삭제, 발급된 비밀번호, 수단·키 제거 |
| `TextInput` | 흰 둥근 입력. `size` sm(13px) md lg(15px) | 로그인, 설정의 입력 |
| `KeyValue` | 왼쪽 96px 회색 키, 오른쪽 값과 버튼 | 설정의 세부 |
| `Logo` | 제공사 로고(openai, anthropic, xai) | 답변의 프로필 |
| `Icon` | 24 격자 1.5 선. 이름으로 고른다 | 모든 아이콘 |
| `toast()` (`ui/Toaster.tsx`) | 화면 아래 흰 알약 | 짧은 알림 |
| `Steps` `StepMark` | 체크·진행 점과 세로선, 단계별 걸린 시간 | 수집 진행(홈 답변), 수집 카드 |
| `usePresence` | `open` 이 꺼져도 200ms 남겨 나가는 애니메이션을 재생하는 훅. `{ mounted, leaving, content }` | 모든 덮개 |
| `useLeaving` | 목록이 바뀔 때 지워진 항목을 200ms 남기고(`leaving`) 새 항목을 표시(`entering`)하는 훅. 각 줄을 `<Fold open={!leaving && !entering}>` 로 감싸 높이가 접히고 펼쳐진다 | 사이드바 목록, 탭 줄, 설정 목록, 주석·칩 목록 |
| `useEscape` `useOutside` | Esc 와 바깥 클릭으로 닫는 훅. `capture` 면 안쪽 창만 닫힌다 | 메뉴, 모달, 팝업, 선택 막대 |
| `Skeleton` | 빛이 지나가는 회색 막대. `lines` 로 여러 줄, `className` 으로 크기와 모양 | 데이터를 기다리는 모든 자리 |

버튼 규칙:

- 브라우저의 `confirm()` `alert()` `prompt()` 를 쓰지 않는다. 확인은 `Popup` 으로 묻는다.

- 채움 버튼은 한 화면(모달, 패널)에 하나. 두 번째 동작은 윤곽이나 회색이다.
- 버튼 안 글자 크기는 `size="sm"`(12px) 과 `size="md"`(13px) 둘. 15px 는 페이지 머리의 `size="lg"` 만.
- 올림은 `tone` 이 정한다. 화면에서 hover 클래스를 덧붙이지 않는다.
- 아이콘만 있는 버튼에는 `label` 을 준다(aria-label 과 title 이 된다).

## 스타일

- 색은 토큰 이름으로만 쓴다: `slate-*`(Apple 회색 단계로 덮어씀), `apple` `apple-hover` `apple-link` `apple-signal` `ice` `ok`. `#0071e3` 같은 값을 클래스에 쓰지 않는다.
- 반경은 `rounded-md`(6) `rounded-lg`(8) `rounded-xl`(8) `rounded-2xl`(12) `rounded-full` 만.
- 그림자를 쓰지 않는다. 경계는 `ring-1 ring-slate-200` 이나 `border-slate-100`.
- 글자 크기는 11, 12, 13, 14, 15, 17, 21, 40px 뿐이다. 보조 수치(단계 시간, 개수)와 대문자 라벨은 11, 시트·그래프·로그인 제목은 21, 홈 머리만 40 이다. 대문자 머리는 `text-[11px]` 이나 `text-[13px]` + `font-semibold uppercase tracking-wide text-slate-500`.
- `style={{}}` 는 계산된 값(폭, 위치, CSS 변수)에만 쓴다.
- 클래스를 조건으로 붙일 때는 `lib/cx.ts` 의 `cx()` 를 쓴다.
- 마크다운 본문은 `globals.css` 의 `.prose-doc`(문서) `.md-chat`(대화) `.article`(답변·수업) 셋 중 하나로 감싼다.
- 움직임은 `Fold`, `Chevron`, `enter-*` `exit-*` 클래스로만 만든다. 들어올 때는 `--ease-spring`, 작은 것(`enter-fade` `enter-pop`) 180ms, 큰 판(`enter-rise`) 260ms. 나갈 때는 `--ease-exit`(고르게 줄어드는 곡선)로, 작은 것(`exit-fade` `exit-pop`) 140ms, 큰 판(`exit-rise`)과 그 뒤 어두운 배경·패널(`exit-veil`) 200ms. 같은 종류는 들어온 모양 그대로 나간다(rise 로 들어온 것은 rise 로 나간다). 색과 투명도만 바뀌는 상태 변화(hover, 선택)는 `transition` + `duration-150`. `prefers-reduced-motion` 이면 움직이지 않는다.
- 사라지는 것도 움직인다. 조건부로 그리는 덮개(모달, 팝업, 메뉴, 시트, 막대, 칩, 토스트)는 `{open && <X/>}` 로 바로 지우지 않고, `X` 가 `open` 을 받아 `ui/usePresence` 로 200ms 남겨 `exit-*` 를 재생한 뒤 지운다. 나가는 동안은 `usePresence` 가 돌려주는 마지막 내용(`content`)을 그려서, 부모 데이터가 먼저 비어도 모양이 깨지지 않는다. `Modal` `Popup` `Menu` `Toaster` 가 이 방식이다.
- 목록의 줄이 생기거나 지워지면 `useLeaving` + `Fold` 로 높이가 펼쳐지고 접힌다. 아래 줄들이 한 번에 튀어 오르지 않는다. 처음 불러온 목록은 줄마다가 아니라 묶음 하나로 `enter-fade` 한다.
- 레이아웃의 칸(작업대 열, 탭)이 생기거나 없어지면 칸의 크기도 같은 시간 동안 움직인다. 내용만 흐려지고 남은 칸이 한 번에 넓어지지 않게 한다. 작업대 열은 `grid-template-columns` 전환(닫힐 칸 `0fr`, 새 칸 `0fr` → `1fr`), 폰 탭은 `PaneTabs` 의 `Tab` 이 Fold 처럼 Web Animations 로 폭을 움직인다. 클래스로 할 수 없는 크기 움직임은 이 두 방식만 쓴다.
- 같은 자리에서 내용만 바뀌면(다른 문서를 같은 패널에 열기, 설정 화면 전환, 언어 전환) 새 내용에 `enter-fade` 를 key 로 다시 재생한다.
- 데이터를 기다리는 자리는 `Skeleton` 으로 그 자리에 올 내용의 모양을 흉내 낸다. 줄 수와 폭, 높이를 실제 내용에 맞춰 레이아웃이 도착할 때 흔들리지 않게 한다. "Loading…" 글자, 빈 화면, 회전 표시를 쓰지 않는다. 스켈레톤은 150ms 뒤에 나타나므로 빨리 끝나는 로딩에서는 보이지 않는다.
- 스켈레톤 자리에 내용이 도착하면 그 내용 묶음에 `enter-fade` 를 붙인다. 목록은 항목마다가 아니라 묶음 하나에 붙인다. 실패하면 스켈레톤을 지우고 서버의 문장을 보여 준다.
- 진행 중인 작업(모델 답변, 수집)은 스켈레톤이 아니라 지금처럼 `Steps`, `pulse-dot`, `typing` 으로 보여 준다. 스켈레톤은 "이미 있는 것을 가져오는 중"에만 쓴다.

## 반응형

| 폭 | 사이드바 | 작업대 | 설정 |
|---|---|---|---|
| 1024px 이상 | 본문 옆에 나란히, 폭 조절 | 그룹 수만큼 열 | 왼쪽 내비 + 오른쪽 내용 |
| 768~1023px | 덮개(overlay). 항목을 고르면 닫힌다 | 그룹 수만큼 열 | 왼쪽 내비 + 오른쪽 내용 |
| 768px 미만 | 덮개 | 한 열. 맨 위 `PaneTabs` 탭 줄이 그룹을 나열하고 가로로 스크롤된다. 탭은 패널 바와 같은 `유형 / 이름` 모양이고 ×로 닫는다. 패널 안의 패널 바는 숨기고, 문서의 내려받기 버튼은 활성 탭 안에 둔다 | 640px 미만이면 전체 화면. 첫 화면은 내비 목록, 항목을 누르면 상세, `‹` 로 돌아온다 |

- 기준 폭은 Tailwind 의 `sm`(640) `md`(768) `lg`(1024) 셋만 쓴다. 덮개 기준은 `Shell.tsx` 의 `OVERLAY` 한 곳이다.
- 768px 미만에서는 `body { zoom }`(`globals.css`)로 모든 요소를 키운다. 768 미만 2.5%, 640 미만 5%, 540 미만 7.5%, 480 미만 10%. 레이아웃 폭은 그만큼 줄어들고(390px 폰이면 354px), 미디어 쿼리는 실제 폭을 본다.
- `crypto.randomUUID` 는 http(LAN 주소)에서 없으므로 `lib/id.ts` 의 `uuid()` 를 쓴다.
- 메뉴는 화면 끝에 닿으면 반대쪽으로 펼친다(`MenuButton`). 긴 글은 `break-words`, 토글 글자는 `whitespace-nowrap`.
- 설정의 키-값(`KeyValue`)은 640px 미만에서 키가 값 위에 쌓인다.
- 대화 입력창(`InputBar`)은 자기 폭이 512px(`@max-lg`) 미만이면 두 줄이다. 위 줄에 제공사·모델 메뉴, 아래 줄에 입력칸과 보내기. 폰에서도, 데스크톱에서 패널을 여럿 나눠 좁아져도 같다.
- 터치 화면(`pointer: coarse`)에서는 `IconButton` 의 누르는 영역만 세로 5px, 가로 8px 넓힌다(`.touch`). 보이는 크기는 같다.
- 폰 흐름은 `check/mobile.py` 로 점검한다(390×844).

## 상태와 데이터

- 화면 상태는 그 컴포넌트의 `useState` 에 둔다. 전역 Context 는 작업대(`WorkbenchProvider`) 하나뿐이다. 패널 사이의 일(근거 문서 열기 `open`, 인용 보내기 `sendQuote`, 지금 문서 `doc`, 포커스)은 모두 이 Context 를 거친다.
- 기능 사이의 짧은 신호는 `lib/events.ts` 의 이름 있는 이벤트로 보낸다: `spaces`(space 목록이 바뀜), `settings`(제공사 설정이 바뀜), `zoom`(글자 크기가 바뀜), `agents`(홈 대화가 생기거나 바뀜), `auth`(어떤 요청이 401 을 받음. Shell 이 로그인 화면으로 바꾼다), `sidebar`(사이드바 항목을 골랐음. 덮개일 때 Shell 이 닫는다), `collected`(수집이 끝나 수집물 트리가 바뀜), `collect`(사이드바의 새 수집을 누름. 홈 입력창이 collect 모드로 바뀐다). 새 신호도 여기에 이름을 더한다.
- `fetch` 는 `lib/api.ts` 에서만 부른다. 엔드포인트마다 함수 하나, 응답 타입을 함께 둔다. 실패하면 서버의 `error` 문장으로 `ApiError` 를 던지고, 화면이 그 문장을 보여 준다.
- 브라우저 저장은 `lib/storage.ts` 의 `load` `save` 만 쓴다. 오래 남길 취향은 localStorage: `workbench` `sidebarWidth` `sidebarOpen` `spaceExpanded` `docZoom` `chatZoom` `docLang` `dlFmt` `homeMode` `lastDoc` `model` `space-draft:<그룹>` `pg:<key>`. 새로고침에만 이어지면 되는 화면 상태는 세 번째 인자 `true` 로 sessionStorage: `settingsOpen` `settingsTab` `settingsPage` `sidebarScroll` `chatScroll:<그룹>` `docScroll:<경로>`.
- 문서와 대화 글자 크기는 `<html>` 의 CSS 변수 `--doc-zoom` `--chat-zoom` 으로 퍼뜨린다.

## 이름

- 컴포넌트 파일은 PascalCase, 파일 하나에 `export default` 컴포넌트 하나. 그 컴포넌트만 쓰는 작은 부속은 같은 파일 아래에 둔다.
- 훅은 `useX`, 그 feature 의 파일로 둔다. 두 feature 이상이 쓰면 `ui/` 나 `lib/`.
- props 이름은 하는 일로 짓는다(`onOpen`, `onRemove`). `data` `info` `handle*` 같은 뜻 없는 이름을 쓰지 않는다.
- 준말을 쓰지 않는다(`id` 만 예외).

## 주석

[global-convention](../global-convention.md) 그대로다. TSX 와 CSS 에도 설명 주석을 쓰지 않고, `{/* sidebar */}` 처럼 세 단어 이하 라벨만 둔다.

## 검증

- 바꾼 뒤에는 `npm run build` 가 경고 없이 끝나야 한다.
- 화면 흐름은 `check/` 의 Playwright 스크립트로 눌러 본다(`uv run --with playwright python check/<이름>.py <스크린샷 폴더>`). api(28300) 와 `npm run dev`(3000) 가 떠 있어야 하고, 점검용 계정을 `UWI_EMAIL` `UWI_PASSWORD` 로 넘긴다(`check/account.py` 가 로그인한다). 다른 주소는 `UWI_URL`, 창을 보려면 `HEADED=1`.
- 새 화면 흐름을 만들면 그 흐름의 점검 스크립트도 하나 둔다.
- 점검은 실제 DB 를 쓰는 api(28300)와 dev 서버(3000)를 건드리지 않고 따로 띄운 점검용 쌍에서 돌린다. DB 사본으로 `ENCRYPTION_KEY=<.env.develop 의 값> PORT=8797 DATABASE_URL=<사본 DB 주소> python3 worship_support/api/bin/server.py`(사본은 `createdb -T worship_support <이름>`), 화면은 `NEXT_DIST_DIR=.next-check API_URL=http://127.0.0.1:8797 npx next dev -p 3010`, 스크립트는 `UWI_URL=http://localhost:3010`. 그래야 점검 중에도 실제 계정으로 로그인된다.
