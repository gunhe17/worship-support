from abc import ABC, abstractmethod
from uuid import UUID

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
