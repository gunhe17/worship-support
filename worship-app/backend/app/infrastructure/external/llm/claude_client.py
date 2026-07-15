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
반드시 YouTube에서 실제로 검색 가능한 한국 찬양팀의 실존 곡만 추천하세요.
추천 찬양팀: 마커스워십, WELOVE, F.I.A, 제이어스, 어노인팅, 온누리워십, 소리엘, 예수전도단, 다윗의장막, 시와그림, 화나, 워십메이커스, 강찬 등.
존재하지 않는 곡 추천 금지.

[규칙 1 — 최우선] 가사가 성경 본문의 핵심 메시지와 직접 연결되는 곡을 선정하세요.

[규칙 2 — 절대 준수] 곡 순서와 분위기는 아래 위치를 반드시 지켜야 합니다. 절대 바꾸지 마세요:
  1번 곡: 느린곡 (mood: "slow", BPM 75 이하, 잔잔한 경배/고백 분위기로 예배 시작)
  2번 곡: 빠른곡 (mood: "fast", BPM 100 이상, 활기찬 찬양/선포 분위기)
  3번 곡: 빠른곡 (mood: "fast", BPM 100 이상, 활기찬 찬양/선포 분위기)
  4번 곡: 느린곡 (mood: "slow", BPM 75 이하, 깊은 경배/헌신 분위기)
  5번 곡: 느린곡 (mood: "slow", BPM 75 이하, 마무리 경배/헌신 분위기)
  ※ 1번은 반드시 느린곡이어야 합니다. 빠른곡을 1번에 넣으면 안 됩니다.

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
  "connection_note": "예배 시작곡"
}}]"""

        direction_text = f"\n설교 방향성: {sermon_direction}" if sermon_direction.strip() else ""
        prompt = (
            f"예배 유형: {worship_type}\n"
            f"성경 본문: {scripture}\n"
            f"주제: {', '.join(themes)}{direction_text}\n"
            f"예배 총 시간: {duration_minutes}분 (찬양 가용 시간: 약 {available_minutes}분)\n\n"
            "위 규칙을 모두 지켜 실존 한국 찬양 5곡을 추천해주세요.\n"
            "※ 반드시 1번 곡은 느린곡(BPM 75 이하)이어야 합니다."
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
        scripture: str,
        theme: str,
        worship_type: str,
    ) -> dict:
        system = (
            "당신은 경험 많은 한국 예배 인도자입니다. "
            "찬양의 섹션 전환 시점에 인도자가 자연스럽게 할 수 있는 짧은 멘트를 작성합니다. "
            "멘트는 회중의 집중을 유도하고 다음 섹션으로 자연스럽게 이어지는 흐름이어야 합니다. "
            "구어체로 자연스럽게, 1~3문장 이내로 작성하세요. "
            "반드시 아래 형식의 JSON만 출력하세요:\n"
            '{"ment": "주요 멘트", "alternatives": ["대안 멘트1", "대안 멘트2"]}'
        )
        prompt = (
            f"예배 유형: {worship_type}\n"
            f"성경 본문: {scripture}\n"
            f"예배 주제: {theme}\n"
            f"현재 찬양: {song_title}\n"
            f"섹션 전환: {section_from} → {section_to}\n\n"
            f"위 상황에서 '{section_from}'에서 '{section_to}'로 넘어갈 때 인도자가 할 멘트를 추천해주세요."
        )
        return await self._call(system, prompt)
