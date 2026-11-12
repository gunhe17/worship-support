from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel


# #
# input

class In(BaseModel):
    ...


# #
# output

@dataclass(frozen=True, kw_only=True)
class Out:
    data: Any = None
    event: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "data": self.data,
            "event": self.event,
        }
