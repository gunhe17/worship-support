import json
import re

import anthropic
import httpx

from app.common.config.settings import settings
from app.common.exception.exceptions import raise_app_error


def _extract_json(text: str) -> dict | list:
    """응답 텍스트에서 JSON 블록을 추출합니다."""
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())
    stripped = text.strip()
    if stripped.startswith("{") or stripped.startswith("["):
        return json.loads(stripped)
    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if match:
        return json.loads(match.group(1))
    raise ValueError(f"JSON을 찾을 수 없습니다: {text[:200]}")


class ClaudeClient:
    def __init__(self):
        http_client = httpx.AsyncClient(trust_env=False)
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            http_client=http_client,
        )
        self._model = "claude-sonnet-4-6"

    async def _call(self, system: str, prompt: str, max_tokens: int = 2048) -> dict | list:
        try:
            message = await self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = message.content[0].text
            return _extract_json(text)
        except json.JSONDecodeError:
            raise_app_error("AI_SERVICE_ERROR")
        except Exception:
            raise_app_error("AI_SERVICE_ERROR")

    async def analyze_scripture(self, scripture: str, worship_type: str, sermon_direction: str = "") -> dict:
        system = (
            "당신은 예배 기획 전문가입니다. "
            "성경 본문(및 설교 방향성이 있다면 그것까지 함께)을 분석하여 "
            "예배 흐름에 맞는 주제, 키워드, 스토리라인, 감정 흐름을 반환합니다. "
            "설교 방향성이 제공된 경우 스토리라인과 감정 흐름에 반드시 반영하세요. "
            "반드시 아래 형식의 JSON만 출력하세요. 설명 없이 JSON만:\n"
            '{"themes": ["주제1", "주제2"], "keywords": ["키워드1"], '
            '"storyline": "스토리라인 설명", "emotional_flow": ["감정1", "감정2"]}'
        )
        direction_text = f"\n설교 방향성: {sermon_direction}" if sermon_direction.strip() else ""
        prompt = f"예배 유형: {worship_type}\n본문: {scripture}{direction_text}"
        return await self._call(system, prompt)

    async def recommend_songs(self, scripture: str, themes: list[str], worship_type: str, count: int) -> list:
        system = (
            "당신은 한국 찬양 큐레이터입니다. "
            "반드시 YouTube에서 실제로 검색 가능한 한국 찬양팀의 실존 곡만 추천하세요. "
            "추천 가능한 찬양팀: 마커스워십, WELOVE, F.I.A, 제이어스, 어노인팅, 온누리워십, "
            "소리엘, 예수전도단, 다윗의장막, 시와그림 등. "
            "존재하지 않는 곡은 절대 추천하지 마세요. "
            "반드시 아래 형식의 JSON 배열만 출력하세요. 설명 없이 JSON만:\n"
            '[{"title": "실제 곡명", "artist": "실제 찬양팀명", '
            '"reason": "추천이유(본문과의 연관성)", '
            '"recommended_key": "G", "bpm": 80, '
            '"song_form": ["Intro", "Verse1", "Chorus", "Bridge", "Outro"]}]'
        )
        prompt = (
            f"예배 유형: {worship_type}\n"
            f"본문: {scripture}\n"
            f"주제: {', '.join(themes)}\n"
            f"추천 곡 수: {count}곡\n\n"
            "위 조건에 맞는 실존 한국 찬양 곡을 추천해주세요."
        )
        result = await self._call(system, prompt)
        return result if isinstance(result, list) else result.get("recommendations", [])

    async def recommend_songs_full(
        self,
        scripture: str,
        themes: list[str],
        worship_type: str,
        duration_minutes: int,
        count: int,
        sermon_direction: str = "",
    ) -> list:
        """
        분위기 패턴(느린→빠른→빠른→느린→느린) + 곡 연결 방식 + 예배 시간 + 가사 우선 선곡.
        """
        available_minutes = int(duration_minutes * 0.7)
        system = f"""당신은 한국 예배 찬양 큐레이터입니다.

[최우선 규칙 — 절대 준수]
반드시 당신이 확실히 알고 있는 실존하는 한국 찬양만 추천하세요.
제목이 비슷하거나 그럴듯해 보여도 확신이 없으면 절대 추천하지 마세요.
아래 예시 목록처럼 YouTube에서 실제로 검색되는 곡만 사용하세요.

추천 찬양팀: 마커스워십, WELOVE(위러브), F.I.A(피아워십), 제이어스, 어노인팅, 온누리워십, 소리엘, 예수전도단, 다윗의장막, 시와그림, 화나, 워십메이커스, 강찬, 홀리원, 힐송코리아 등.

[mood 기준 + 실존 곡 예시 — 이 목록 안에서 우선 선택]
  "slow" (잔잔한 경배/묵상/헌신):
    그 사랑(마커스워십), 주 품에(마커스워십), 내 삶을 드리리(예수전도단),
    예수 나의 첫사랑 되시네(마커스워십), 내가 매일 기쁘게(마커스워십),
    주님 다시 오실 때까지(어노인팅), 내 영혼이 은총 입어(어노인팅),
    사랑합니다 나의 예수님(어노인팅), 주님의 사랑이(소리엘),
    주의 음성을 내가 들으니(예수전도단), 하나님의 사랑(예수전도단),
    주가 보이신 생명의 길(예수전도단), 내 구주 예수님(온누리워십),
    나의 반석이신 하나님(마커스워십), 은혜(마커스워십)

  "medium" (적당히 활기찬 찬양):
    우리는 주의 움직이는 교회(제이어스), 주와 함께 걸어가네(마커스워십),
    찬양하라 내 영혼아(마커스워십), 주님 한 분만으로(마커스워십),
    나는 주를 작은 배에(예수전도단), 내 인생 주관하시는(어노인팅),
    주의 이름 높이며(어노인팅), 아버지(마커스워십),
    하나님 아버지의 마음(온누리워십), 주님 내 길 되시니(소리엘),
    복음 안에서(마커스워십), 주 보혈 날 씻기시네(WELOVE)

  "fast" (활기찬 선포/축제):
    우리 주 안에서 노래하며(WELOVE), 성령의 불타는 교회(제이어스),
    부흥 있으리라(제이어스), 승리하였네(마커스워십),
    주 이름 찬양(마커스워십), 할렐루야(예수전도단),
    모든 민족 주 찬양(어노인팅), 주님 오시네(온누리워십),
    하나님은 너를 만드신 분(화나), 새 힘 얻으리(어노인팅),
    일어나라 빛을 발하라(온누리워십), 왕이신 나의 하나님(마커스워십)

[규칙 1 — 절대 최우선] 반드시 곡의 "가사 내용"을 기준으로 선정하세요. 제목이 아닙니다.
  - 해당 곡의 가사가 성경 본문의 핵심 메시지(죄 용서, 사랑, 회복, 찬양 등)를 직접 담고 있어야 합니다.
  - 가사를 모르는 곡은 절대 추천하지 마세요.
  - reason 필드에는 반드시 "가사의 어떤 내용이 본문과 연결되는지"를 구체적으로 설명하세요.

[규칙 2 — 절대 준수] 아래 두 패턴 중 예배 주제에 더 어울리는 것을 하나 선택하세요.
  패턴 A: slow → fast → fast → slow → slow
    1번: slow, 2번: fast, 3번: fast, 4번: slow, 5번: slow
  패턴 B: slow → fast → fast → medium → slow
    1번: slow, 2번: fast, 3번: fast, 4번: medium, 5번: slow

  ※ 절대 불변 규칙: 1번 곡과 5번 곡은 반드시 "slow"이어야 합니다.
  ※ mood와 실제 곡의 분위기가 반드시 일치해야 합니다. (BPM 숫자가 아닌 곡의 실제 느낌 기준)

[규칙 3] 총 찬양 가용 시간 {available_minutes}분 이내 (예배 {duration_minutes}분의 70%)

[규칙 4] 곡 간 연결 방식 (connection_to_prev 필드):
  - 1번 곡: "start"
  - 이전 곡과 키가 같고 BPM 차이 ±15 이내: "chorus_to_chorus"
  - 그 외: "end_to_intro"

반드시 아래 형식의 JSON 배열만 출력하세요. 설명 없이 JSON만:
[{{
  "title": "실제 곡명",
  "artist": "실제 찬양팀명",
  "reason": "가사 기반 추천 이유",
  "recommended_key": "G",
  "bpm": 70,
  "mood": "slow",
  "estimated_duration_minutes": 5.0,
  "song_form": ["Intro", "Verse1", "Chorus", "Bridge", "Outro"],
  "connection_to_prev": "start",
  "connection_note": "예배 시작곡",
  "youtube_search_query": "곡명 찬양팀명으로 YouTube에서 찾을 때 가장 정확한 검색어 (예: 그 사랑 마커스워십 라이브)"
}}]"""

        direction_text = f"\n설교 방향성: {sermon_direction}" if sermon_direction.strip() else ""
        prompt = (
            f"예배 유형: {worship_type}\n"
            f"성경 본문: {scripture}\n"
            f"주제: {', '.join(themes)}{direction_text}\n"
            f"예배 총 시간: {duration_minutes}분 (찬양 가용 시간: 약 {available_minutes}분)\n\n"
            "위 규칙을 모두 지켜 실존 한국 찬양 5곡을 추천해주세요.\n"
            "※ 1번=slow, 5번=slow는 절대 불변입니다.\n"
            "※ 패턴A(slow→fast→fast→slow→slow) 또는 패턴B(slow→fast→fast→medium→slow) 중 선택하세요."
        )
        result = await self._call(system, prompt, max_tokens=3000)
        return result if isinstance(result, list) else result.get("recommendations", [])

    async def recommend_key(self, song_id: str, vocal_type: str, congregation_type: str) -> dict:
        system = (
            "당신은 음악 디렉터입니다. "
            "보컬 유형과 회중 특성을 고려하여 최적의 Key를 추천합니다. "
            "반드시 아래 형식의 JSON만 출력하세요:\n"
            '{"recommended_keys": ["G", "A"], "reason": "이유"}'
        )
        prompt = f"곡 ID: {song_id}\n보컬 유형: {vocal_type}\n회중 유형: {congregation_type}"
        return await self._call(system, prompt)

    async def recommend_song_form(self, song_id: str, worship_context: str) -> dict:
        system = (
            "당신은 예배 인도자입니다. "
            "예배 맥락에 맞는 Song Form을 추천합니다. "
            "반드시 아래 형식의 JSON만 출력하세요:\n"
            '{"song_form": ["Intro", "Verse", "Chorus", "Bridge", "Outro"], "reason": "이유"}'
        )
        prompt = f"곡 ID: {song_id}\n예배 맥락: {worship_context}"
        return await self._call(system, prompt)

    async def recommend_tempo(self, song_id: str, worship_context: str) -> dict:
        system = (
            "당신은 음악 디렉터입니다. "
            "예배 맥락에 맞는 BPM을 추천합니다. "
            "반드시 아래 형식의 JSON만 출력하세요:\n"
            '{"recommended_bpm": 80, "range": {"min": 72, "max": 88}, "reason": "이유"}'
        )
        prompt = f"곡 ID: {song_id}\n예배 맥락: {worship_context}"
        return await self._call(system, prompt)

    async def recommend_ment(self, worship_id: str, position: str) -> dict:
        system = (
            "당신은 예배 인도자입니다. "
            "예배 위치(시작/중간/마무리)에 맞는 자연스러운 한국어 멘트를 작성합니다. "
            "반드시 아래 형식의 JSON만 출력하세요:\n"
            '{"ment": "주요 멘트", "alternatives": ["대안 멘트1", "대안 멘트2"]}'
        )
        prompt = f"예배 위치: {position}\n예배 ID: {worship_id}"
        return await self._call(system, prompt)

    async def recommend_section_ment(
        self,
        song_title: str,
        section_from: str,
        section_to: str,
        bars_from: int,
        bars_to: int,
        scripture: str,
        theme: str,
        worship_type: str,
    ) -> dict:
        system = """당신은 경험 많은 한국 예배 인도자입니다.
찬양 섹션 전환 시점에 인도자가 하는 짧은 멘트를 작성합니다.

[멘트 작성 규칙 — 반드시 준수]
1. 어미: "요"로 끝내지 말 것. 반드시 "합시다", "하겠습니다", "좋겠습니다", "드리겠습니다", "입니다" 중 하나로 끝낼 것.
2. 불필요한 조사·부사 사용 금지: "자", "이제", "함께", "여러분", "정말", "한번" 등 군더더기 표현 제거.
3. 찬양을 전달하는 인도자 입장으로만 말할 것. 감정 표현이나 설명은 넣지 말 것.
4. 1~2문장 이내. 마디 수에 맞게 간결하게 작성할 것.
5. 마디가 짧으면(8마디 이하) 더 짧게, 길면 조금 더 길게.

좋은 예시:
- "코러스를 한 번 더 드리겠습니다."
- "브릿지로 넘어가겠습니다."
- "마지막으로 찬양하겠습니다."
- "처음부터 찬양하겠습니다."

나쁜 예시 (금지):
- "자 이제 다함께 코러스로 넘어가 볼게요."
- "여러분 정말 아름다운 찬양이에요."
- "함께 브릿지를 불러봐요."

반드시 아래 JSON만 출력하세요:
{"ment": "주요 멘트", "alternatives": ["대안 멘트1", "대안 멘트2"]}"""

        prompt = (
            f"예배 유형: {worship_type}\n"
            f"성경 본문: {scripture}\n"
            f"예배 주제/방향: {theme}\n"
            f"현재 찬양: {song_title}\n"
            f"섹션 전환: {section_from}({bars_from}마디) → {section_to}({bars_to}마디)\n\n"
            f"'{section_from}'({bars_from}마디)이 끝나고 '{section_to}'({bars_to}마디)로 넘어갈 때 인도자가 할 멘트를 추천해주세요."
        )
        return await self._call(system, prompt)

    async def recommend_song_form_with_bars(
        self,
        song_title: str,
        artist: str,
        bpm: int,
        worship_type: str,
        available_minutes: float,
    ) -> dict:
        system = f"""당신은 예배 음악 편곡 전문가입니다.
찬양 곡의 BPM과 배정 시간을 고려하여 최적의 송폼과 각 섹션 마디 수를 추천합니다.

계산 기준:
- 1마디 = 4박자
- 연주 시간(초) = 마디 수 × 4 / BPM × 60
- 총 시간이 {available_minutes}분 이내가 되도록 마디 수를 배분하세요.

섹션 이름은 반드시 영문으로: Intro, Verse, Verse2, Pre-Chorus, Chorus, Bridge, Tag, Inter, Outro 중에서 선택.
자연스러운 예배 흐름이 되도록 구성하고, 마디 수는 4의 배수로만 사용하세요.

반드시 아래 JSON만 출력하세요:
{{"sections": [{{"name": "Intro", "bars": 8}}, ...], "total_estimated_minutes": 5.0}}"""

        prompt = (
            f"찬양: {song_title} ({artist})\n"
            f"BPM: {bpm}\n"
            f"예배 유형: {worship_type}\n"
            f"배정 시간: 약 {available_minutes}분\n\n"
            "위 조건에 맞는 송폼과 각 섹션 마디 수를 추천해주세요."
        )
        return await self._call(system, prompt)

    async def extract_worship_info(self, raw_text: str) -> dict:
        system = """당신은 교회 예배 기획 보조입니다.
목사님께서 주신 설교 자료나 메모에서 예배 정보를 추출합니다.

반드시 아래 JSON만 출력하세요:
{"title": "설교 주제 또는 제목", "scripture": "말씀 본문", "sermon_direction": "설교 방향성 (없으면 null)"}

규칙:
- title: 설교 주제나 제목만 넣으세요. 성경 구절 자체(예: 요한복음 15장)는 절대 넣지 마세요. 주제가 없으면 핵심 메시지를 짧게 요약하세요.
- scripture: 성경 구절 형식으로만 (예: "요한복음 15:1-8", "시편 23편"). 주제나 설명은 넣지 마세요.
- sermon_direction: 설교 방향성, 핵심 메시지, 강조점이 있으면 추출. 없으면 반드시 null."""

        prompt = f"다음 텍스트에서 예배 정보를 추출해주세요:\n\n{raw_text}"
        return await self._call(system, prompt, max_tokens=512)
