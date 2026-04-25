from abc import abstractmethod
from typing import Any


class Repository:
    # #
    # create

    @abstractmethod
    def add(self, entity) -> Any:
        ...

    @abstractmethod
    def add_many(self, entities) -> Any:
        ...

    # #
    # read

    @abstractmethod
    def get(self, id) -> Any:
        ...

    @abstractmethod
    def get_many(self, ids) -> Any:
        ...

    @abstractmethod
    def exists(self, id) -> Any:
        ...

    # #
    # update

    @abstractmethod
    def update(self, entity) -> Any:
        ...

    @abstractmethod
    def update_many(self, entities) -> Any:
        ...

    # #
    # delete

    @abstractmethod
    def remove(self, id) -> Any:
        ...

    @abstractmethod
    def remove_many(self, ids) -> Any:
        ...
