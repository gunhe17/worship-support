from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entity.song import Song
from app.domain.entity.song_section import SongSection


class SongRepository(ABC):
    @abstractmethod
    async def save(self, song: Song) -> Song: ...

    @abstractmethod
    async def find_by_id(self, song_id: UUID) -> Song | None: ...

    @abstractmethod
    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Song]: ...

    @abstractmethod
    async def search(self, keyword: str) -> list[Song]: ...

    @abstractmethod
    async def update(self, song: Song) -> Song: ...

    @abstractmethod
    async def delete(self, song_id: UUID) -> None: ...

    @abstractmethod
    async def find_sections(self, song_id: UUID) -> list[SongSection]: ...

    @abstractmethod
    async def save_section(self, section: SongSection) -> SongSection: ...

    @abstractmethod
    async def update_section(self, section: SongSection) -> SongSection: ...

    @abstractmethod
    async def delete_section(self, section_id: UUID) -> None: ...

    @abstractmethod
    async def find_section_by_id(self, section_id: UUID) -> SongSection | None: ...

    @abstractmethod
    async def reorder_sections(self, song_id: UUID, section_ids: list[UUID]) -> list[SongSection]: ...
