from __future__ import annotations

from typing import Protocol

from app.domains.user.domain import Email, User


class UserRepository(Protocol):
    def get(self, user_id: str) -> User | None:
        ...

    def get_by_email(self, email: Email) -> User | None:
        ...

    def exists_by_email(self, email: Email) -> bool:
        ...

    def add(self, user: User) -> None:
        ...


class SqlAlchemyUserRepository:
    def get(self, user_id: str) -> User | None:
        raise NotImplementedError

    def get_by_email(self, email: Email) -> User | None:
        raise NotImplementedError

    def exists_by_email(self, email: Email) -> bool:
        raise NotImplementedError

    def add(self, user: User) -> None:
        raise NotImplementedError
