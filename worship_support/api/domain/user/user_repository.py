from abc import abstractmethod

from worship_support.architecture.core.repository import Repository

from worship_support.architecture.domain.user.user import User
from worship_support.architecture.domain.user.email import Email


class UserRepository(Repository):
    # #
    # create

    @abstractmethod
    def add(self, entity: User) -> None:
        ...

    @abstractmethod
    def add_many(self, entities: list[User]) -> None:
        ...

    # #
    # read

    @abstractmethod
    def get(self, id: str) -> User | None:
        ...

    @abstractmethod
    def get_many(self, ids: list[str]) -> list[User]:
        ...

    @abstractmethod
    def exists(self, id: str) -> bool:
        ...

    @abstractmethod
    def find_by_email(self, email: Email) -> User | None:
        ...

    # #
    # update

    @abstractmethod
    def update(self, entity: User) -> None:
        ...

    @abstractmethod
    def update_many(self, entities: list[User]) -> None:
        ...

    # #
    # delete

    @abstractmethod
    def remove(self, id: str) -> None:
        ...

    @abstractmethod
    def remove_many(self, ids: list[str]) -> None:
        ...
