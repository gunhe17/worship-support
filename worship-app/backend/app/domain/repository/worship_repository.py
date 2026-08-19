from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entity.song_arrangement import SongArrangement
from app.domain.entity.worship import Worship


class WorshipRepository(ABC):
    @abstractmethod
    async def save(self, worship: Worship) -> Worship: ...

    @abstractmethod
    async def find_by_id(self, worship_id: UUID) -> Worship | None: ...

    @abstractmethod
    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Worship]: ...

    @abstractmethod
    async def update(self, worship: Worship) -> Worship: ...

    @abstractmethod
    async def delete(self, worship_id: UUID) -> None: ...

    @abstractmethod
    async def save_ai_result(self, worship_id: UUID, ai_result: dict) -> None: ...

    # ── Arrangement (콘티) ────────────────────────────────────────────────────

    @abstractmethod
    async def save_arrangement(self, arr: SongArrangement) -> SongArrangement: ...

    @abstractmethod
    async def find_arrangements(self, worship_id: UUID) -> list[SongArrangement]: ...

    @abstractmethod
    async def find_arrangement_by_id(self, arr_id: UUID) -> SongArrangement | None: ...

    @abstractmethod
    async def update_arrangement(self, arr: SongArrangement) -> SongArrangement: ...

    @abstractmethod
    async def delete_arrangement(self, arr_id: UUID) -> None: ...
