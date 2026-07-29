# 프로젝트 기획서

---

# 프로젝트명

Worship Support

(가칭)

> 예배 지원회
> 

---

# 프로젝트 목표

## 목적

찬양 인도자가 예배를 준비하는 과정에서 발생하는 반복적인 작업을 최소화하고,

AI를 활용하여

- 본문 분석
- 곡 선정
- 송폼 구성
- Key 추천
- 멘트 작성
- 자료 제작
- 팀 공유

까지 하나의 플랫폼에서 수행할 수 있도록 한다.

최종적으로는

> "예배 준비의 Assistant"
> 

역할을 수행하는 AI 플랫폼을 목표로 한다.

또한 각 부분은 사람이 수정이 가능하고 이 수정 또한 AI Agent가 수정을 진행할 수 있다.

---

# 핵심 가치

기존 

```
본문 선정 → 말씀 묵상 → 찬양 선정 → 유튜브 검색 → 악보 찾기 → Key 변경 
→ 송폼 구성 → 멘트 작성 → 팀원 공유 → 자료 제작
```

AI Platform

```
본문 입력 → AI 분석 → 추천 찬양 → 유튜브 추천 → Key 추천 
→ 송폼 추천 → 멘트 작성 → 자료 자동 제작 → 팀 공유
```

---

# 사용자

## 관리자

- 찬양 데이터 관리
- 악보 관리
- Youtube 관리
- AI Prompt 관리

---

## 찬양 인도자

- 본문 입력
- 찬양 선정
- 송폼 작성
- 멘트 작성
- 자료 생성

---

## 팀원

- 자료 열람
- 유튜브 보기
- 악보 보기

---

# 개발 기술

Backend

```
Python

FastAPI

SQLAlchemy

Alembic

Pydantic

JWT

Redis

Celery
```

---

Frontend

```
React

TypeScript

Next.js

TailwindCSS

Tanstack Query

Shadcn UI
```

---

Database

```
Supabase
```

---

Storage

```
AWS S3

또는

MinIO
```

---

AI

```
미정 하나하나 만들어야됨 추천해줘
```

---

검색

```
Elasticsearch 또는 PostgreSQL Full Text Search
```

---

# 아키텍처

```
Presentation → Application → Domain → Infrastructure
```

DDD 구조

```
app/

    presentation/

        api/

        router/

        dto/

    application/

        service/

        usecase/

        command/

        query/

    domain/

        entity/

        aggregate/

        repository/

        value_object/

        event/

    infrastructure/

        db/

        orm/

        external/

        youtube/

        llm/

        storage/

    common/

        config/

        security/

        logger/

        exception/

tests/
```

---

# Domain 설계

## Worship

예배

```
Worship

id

title

scripture

theme

created_at
```

---

## Song

찬양

```
Song

id

title

artist

default_key

bpm

category

lyrics

sheet
```

---

## SongArrangement

곡 구성

```
SongArrangement

song

key

tempo

song_form

ment

memo
```

---

## YoutubeReference

```
id

song

title

url

channel

arrangement_type
```

---

## Sheet

```
id

song

image

pdf

key
```

---

## Playlist

```
id

name

songs
```

---

# API 목록

## Worship API

```
POST /worship

GET /worship

GET /worship/{id}

PUT

DELETE
```

---

## Song API

```
GET /songs

GET /songs/search

POST /songs

PUT

DELETE
```

---

## Recommendation API

```
POST /recommend/scripture

POST /recommend/song

POST /recommend/key

POST /recommend/songform

POST /recommend/tempo

POST /recommend/ment
```

---

## Youtube API

```
GET /youtube/song

GET /youtube/playlist
```

---

## Export API

```
POST /export/pdf

POST /export/txt

POST /export/ppt

POST /export/image
```

---

# 기능 설계

## 1. 본문 분석

입력

```
말씀 본문
```

↓

AI(스토리라인 생성 (회개 - 찬양 - 감사 - 평안 등등)

```
주제

위로

인도

평안

신뢰
```

↓

추천 키워드

```
은혜

소망

회복

감사
```

---

## 2. 찬양 추천

추천 조건

```
본문

청년예배
```

AI 결과

```
추천 이유

추천 Key

추천 BPM

추천 Song Form
```

---

## 3. Key 추천(왠만하면 영상의 키 따라감)

입력

```
남성

중저음

회중찬양

여성보컬 있음
```

↓

추천

```
G

Ab

A
```

---

## 4. Song Form 추천

예시

```
Intro

Verse1

Verse2

Pre Chorus

Chorus

Inter

Bridge

Chorus

Tag

Ending
```

또는

```
Intro

Verse

Chorus

Verse

Bridge

Chorus

Outro
```

---

## 5. Tempo 추천

```
72 BPM

84 BPM

92 BPM

110 BPM
```

---

## 6. 멘트 추천

예시

```
첫 곡 전 멘트

중간중간 콜링멘트(처음부터 찬양하겠습니다 / 다시한번 찬양 하겠습니다 / 마지막으로 찬양하겠습니다 등등)

마무리 멘트
```

---

## 7. Youtube 추천

각 곡마다

```
Original

마커스

WELOVE

F.I.A

제이어스

어노인팅

컨퍼런스

라이브

MR

Inst
```

등 다양한 편곡 영상을 자동으로 리스트화

---

## 8. 자료 제작

자동 생성

```
악보 이미지

PDF

TXT

PPT

Youtube Playlist

팀 공유 링크
```

---

# AI Agent 설계

가장 중요한 부분

기존 AI는

```
질문

↓

답변
```

하지만 우리가 만들 것은

```
질문

↓

웹 상태 읽기

↓

수정 계획 생성

↓

API 호출

↓

결과 확인

↓

다시 수정

↓

완료
```

---

예시

사용자

```
후렴을 한 번 더 반복해줘
```

↓

AI

```
Song Form 수정
```

↓

API

```
PATCH

/song-arrangement
```

↓

웹 수정

↓

완료

---

또는

사용자

```
Key를 G에서 A로 올려줘.
```

↓

AI

```
PATCH

/song
```

↓

DB 수정

↓

화면 갱신

---

또는

```
이 곡 대신 은혜를 넣어줘
```

↓

AI

```
기존 곡 제거

↓

추천 검색

↓

곡 변경

↓

송폼 재구성

↓

자료 재생성
```

---

# AI Agent 구성

```
Chat UI

↓

LLM

↓

Planner

↓

Tool Selector

↓

API Executor

↓

Validator

↓

Memory

↓

Response
```

---

## Agent Tool 목록

```
Search Scripture

Search Song

Recommend Song

Recommend Key

Recommend Tempo

Recommend Song Form

Recommend Ment

Search Youtube

Generate PDF

Generate TXT

Generate PPT

Generate Playlist

Update Worship

Update Song

Update Arrangement

Delete Song

Export Files
```

각 Tool은 FastAPI의 REST API를 호출하는 형태로 구현합니다.

---

# AI Agent 동작 예시

```
사용자

"2번째 곡을 더 잔잔한 곡으로 바꿔줘"

↓

Planner

↓

현재 예배 읽기

↓

2번째 곡 확인

↓

비슷한 주제 검색

↓

BPM 낮은 곡 검색

↓

추천

↓

교체

↓

송폼 수정

↓

자료 재생성

↓

완료
```

---

# 장기 로드맵

### Phase 1

- 로그인
- 찬양 관리
- 악보 관리
- 유튜브 관리

---

### Phase 2

- 본문 분석
- AI 추천
- 송폼 추천
- 멘트 추천

---

### Phase 3

- 자료 자동 생성
- PDF
- PPT
- TXT
- Playlist

---

### Phase 4

- AI Agent
- 대화형 수정
- 자동 API 호출
- 실시간 화면 변경

---

### Phase 5

- 다중 사용자 협업
- 예배 캘린더
- 팀 권한 관리
- 모바일 앱
- AI 학습(사용자의 예배 스타일을 기억하여 개인화 추천)

---

## 추가로 추천하는 고도화 기능

현재 구상만으로도 충분히 훌륭하지만, 실제 현장에서 더 큰 가치를 제공하려면 다음 기능들을 고려해 보시는 것을 추천드립니다.

### 1. AI 예배 흐름 최적화

- 곡 간 조성(Key) 전환이 자연스러운지 분석
- BPM 변화가 급격하지 않은지 분석
- 예배의 감정선(경배 → 회개 → 은혜 → 결단 → 파송) 자동 평가
- 전체 예배 흐름에 대한 개선 제안

### 2. 찬양 지식 기반(RAG)

- 찬양 가사
- 성경 구절
- 곡 해설
- 작곡자 정보
- 자주 사용되는 송폼
- 과거 예배 데이터

등을 벡터 데이터베이스에 저장하여, 단순 LLM 답변이 아니라 근거 기반의 추천을 제공할 수 있습니다.

### 3. 사용자 맞춤형 AI

예배 인도자마다 선호하는 스타일이 다르므로 다음과 같은 정보를 학습합니다.

- 자주 사용하는 Key
- 선호하는 BPM
- 자주 사용하는 송폼
- 멘트 스타일
- 선호하는 찬양팀 또는 편곡 버전

이를 통해 "평소 스타일대로 구성해줘"와 같은 자연어 명령도 처리할 수 있습니다.

### 4. AI 에이전트 구현 방식

우측 하단 AI 채팅창은 단순 챗봇이 아니라 **도구(Tool)를 호출하는 Agent**로 구현하는 것이 적합합니다.

권장 구조는 다음과 같습니다.

```
React Chat UI
        │
        ▼
FastAPI Agent API
        │
        ▼
LangGraph Workflow
        │
 ┌──────┼────────┐
 ▼      ▼        ▼
Planner Tool   Recommendation Tool   Export Tool
        │
        ▼
FastAPI 내부 REST API
        │
        ▼
PostgreSQL / YouTube / OpenAI / Vector DB
```

이 구조를 사용하면 사용자가 "3번째 곡을 G키로 바꿔주고 멘트도 조금 더 따뜻하게 수정해줘"라고 입력했을 때, 에이전트가 여러 API를 순차적으로 호출하여 실제 데이터를 수정하고 화면까지 자동으로 갱신하는 워크플로를 구현할 수 있습니다.

이러한 구조는 DDD와도 잘 어울리며, 향후 모바일 앱이나 외부 서비스와의 연동도 쉽게 확장할 수 있습니다.