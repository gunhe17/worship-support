"""
인메모리 Repository 구현 (개발/테스트용).
DB 연결이 완료되면 SQLAlchemy 기반으로 교체한다.
"""
from uuid import UUID

from app.domain.entity.song import Song
from app.domain.entity.song_section import SongSection
from app.domain.entity.worship import Worship
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository


class InMemoryWorshipRepository(WorshipRepository):
    _store: dict[UUID, Worship] = {}

    async def save(self, worship: Worship) -> Worship:
        self._store[worship.id] = worship
        return worship

    async def find_by_id(self, worship_id: UUID) -> Worship | None:
        return self._store.get(worship_id)

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Worship]:
        items = list(self._store.values())
        return items[skip : skip + limit]

    async def update(self, worship: Worship) -> Worship:
        self._store[worship.id] = worship
        return worship

    async def delete(self, worship_id: UUID) -> None:
        self._store.pop(worship_id, None)

    async def save_ai_result(self, worship_id: UUID, ai_result: dict) -> None:
        worship = self._store.get(worship_id)
        if worship:
            worship.ai_result = ai_result


class InMemorySongRepository(SongRepository):
    _store: dict[UUID, Song] = {}
    _sections: dict[UUID, SongSection] = {}

    async def save(self, song: Song) -> Song:
        self._store[song.id] = song
        return song

    async def find_by_id(self, song_id: UUID) -> Song | None:
        return self._store.get(song_id)

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Song]:
        items = list(self._store.values())
        return items[skip : skip + limit]

    async def search(self, keyword: str) -> list[Song]:
        kw = keyword.lower()
        return [s for s in self._store.values() if kw in s.title.lower() or kw in s.artist.lower()]

    async def update(self, song: Song) -> Song:
        self._store[song.id] = song
        return song

    async def delete(self, song_id: UUID) -> None:
        self._store.pop(song_id, None)

    async def find_sections(self, song_id: UUID) -> list[SongSection]:
        return sorted(
            [s for s in self._sections.values() if s.song_id == song_id],
            key=lambda s: s.order,
        )

    async def save_section(self, section: SongSection) -> SongSection:
        self._sections[section.id] = section
        return section

    async def update_section(self, section: SongSection) -> SongSection:
        self._sections[section.id] = section
        return section

    async def delete_section(self, section_id: UUID) -> None:
        self._sections.pop(section_id, None)

    async def find_section_by_id(self, section_id: UUID) -> SongSection | None:
        return self._sections.get(section_id)

    async def reorder_sections(self, song_id: UUID, section_ids: list[UUID]) -> list[SongSection]:
        for i, section_id in enumerate(section_ids):
            if section_id in self._sections:
                self._sections[section_id].order = i
        return await self.find_sections(song_id)
