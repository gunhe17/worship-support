from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entity.song import Song


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
