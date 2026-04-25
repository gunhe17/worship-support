from __future__ import annotations

from dataclasses import dataclass


@dataclass
class UserModel:
    id: str
    email: str
    password_hash: str
    name: str
    status: str
    created_at: str
    updated_at: str
    deleted_at: str | None = None
