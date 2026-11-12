from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from uuid import UUID

T = TypeVar("T")


# #
# repository

class Repository(ABC, Generic[T]):
    @classmethod
    @abstractmethod
    async def add(cls, *, session, entity: T) -> T: ...

    @classmethod
    @abstractmethod
    async def find_by_id(cls, *, session, id: UUID) -> T | None: ...

    @classmethod
    @abstractmethod
    async def update(cls, *, session, entity: T) -> Any | None: ...
