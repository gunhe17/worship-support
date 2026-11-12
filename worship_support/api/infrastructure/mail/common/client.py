from __future__ import annotations

from abc import ABC, abstractmethod


# #
# mail

class Mail(ABC):
    @abstractmethod
    def send(self, *, to: str, subject: str, body: str) -> None: ...

    @abstractmethod
    def search(self) -> list[dict]: ...
