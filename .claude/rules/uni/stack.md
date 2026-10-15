---
paths:
  - "worship_support/uni/**"
---

# uni 스택

| 역할 | 선택 |
|---|---|
| 프레임워크 | Expo (React Native) |
| 언어 | TypeScript, React 19 |
| 라우팅 | Expo Router (파일 기반) |
| 서버 데이터 | TanStack Query |
| 린트 | ESLint (`npx expo lint`) |

## 규칙

- Expo는 SDK마다 API가 바뀐다. 기억에 의존하지 말고 `package.json`의 `expo` 메이저 버전에 맞는 문서(`docs.expo.dev/versions/v<major>.0.0/`)를 확인한다.
- 패키지는 `npx expo install`로 추가한다 — SDK 호환 버전을 고른다.
- 화면은 `src/app/`에만, 화면이 아닌 코드(컴포넌트·훅)는 `src/` 아래 다른 폴더에.
- `ios/`·`android/`는 생성물이다. 손으로 만들거나 고치지 않고 `app.json`·config plugin으로 설정한다.
- api 주소는 `EXPO_PUBLIC_API_URL`로 받는다. 앱은 기기에서 돌아서 상대 경로·`localhost`가 api에 닿지 않는다.
- 끝내기 전 `npx tsc --noEmit`, `npx expo lint`.

```
# bad → good
npm install expo-camera                  →  npx expo install expo-camera
fetch("http://localhost:28300/api/songs") →  fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/songs`)
```
