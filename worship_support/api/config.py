from __future__ import annotations

import os
from abc import ABC, abstractmethod
from enum import StrEnum


# #
# environment

class Env(StrEnum):
    DEVELOP = "develop"
    PRODUCTION = "production"


class AppConfig(ABC):
    @property
    @abstractmethod
    def APPLICATION_ENVIRONMENT(self) -> Env: ...


class DefaultAppConfig(AppConfig):
    @property
    def APPLICATION_ENVIRONMENT(self) -> Env:
        raw = os.environ.get("APP_ENV", Env.DEVELOP.value)
        return Env(raw)


def get_app_config() -> AppConfig:
    config = DefaultAppConfig()
    return config

def get_app_environment() -> Env:
    return get_app_config().APPLICATION_ENVIRONMENT

def is_develop() -> bool:
    return (
        get_app_environment() == Env.DEVELOP
    )


# #
# server

class ServerConfig(ABC):
    @property
    @abstractmethod
    def HOST(self) -> str: ...

    @property
    @abstractmethod
    def PORT(self) -> int: ...

    @property
    @abstractmethod
    def CORS_ORIGINS(self) -> list[str]: ...


class DevelopServerConfig(ServerConfig):
    @property
    def HOST(self) -> str:
        return os.environ["DEVELOP_API_HOST"]

    @property
    def PORT(self) -> int:
        return int(os.environ["DEVELOP_API_CONTAINER_PORT"])

    @property
    def CORS_ORIGINS(self) -> list[str]:
        port = os.environ["DEVELOP_UWI_PORT"]
        return [
            f"http://127.0.0.1:{port}",
            f"http://localhost:{port}",
        ]


class ProductionServerConfig(ServerConfig):
    @property
    def HOST(self) -> str:
        return os.environ["PRODUCTION_API_HOST"]

    @property
    def PORT(self) -> int:
        return int(os.environ["PRODUCTION_API_CONTAINER_PORT"])

    @property
    def CORS_ORIGINS(self) -> list[str]:
        port = os.environ["PRODUCTION_UWI_PORT"]
        return [
            f"http://127.0.0.1:{port}",
            f"http://localhost:{port}",
        ]


def get_server_config() -> ServerConfig:
    env = get_app_config().APPLICATION_ENVIRONMENT
    if env == Env.DEVELOP:
        config = DevelopServerConfig()
    elif env == Env.PRODUCTION:
        config = ProductionServerConfig()
    else:
        raise NotImplementedError(f"server config not implemented for env={env}")
    return config


# #
# worker

class WorkerConfig(ABC):
    @property
    @abstractmethod
    def CONCURRENCY(self) -> int: ...


class DevelopWorkerConfig(WorkerConfig):
    @property
    def CONCURRENCY(self) -> int:
        return int(os.environ["DEVELOP_WORKER_CONCURRENCY"])


class ProductionWorkerConfig(WorkerConfig):
    @property
    def CONCURRENCY(self) -> int:
        return int(os.environ["PRODUCTION_WORKER_CONCURRENCY"])


def get_worker_config() -> WorkerConfig:
    env = get_app_config().APPLICATION_ENVIRONMENT
    if env == Env.DEVELOP:
        config = DevelopWorkerConfig()
    elif env == Env.PRODUCTION:
        config = ProductionWorkerConfig()
    else:
        raise NotImplementedError(f"worker config not implemented for env={env}")
    return config


# #
# postgres

class PostgresConfig(ABC):
    @property
    @abstractmethod
    def POSTGRES_HOST(self) -> str: ...

    @property
    @abstractmethod
    def POSTGRES_PORT(self) -> int: ...

    @property
    @abstractmethod
    def POSTGRES_USER(self) -> str: ...

    @property
    @abstractmethod
    def POSTGRES_PASSWORD(self) -> str: ...

    @property
    @abstractmethod
    def POSTGRES_DB(self) -> str: ...

    def database_url(self) -> str:
        return (
            f"postgresql://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}"
            f"/{self.POSTGRES_DB}"
        )


class DevelopPostgresConfig(PostgresConfig):
    @property
    def POSTGRES_HOST(self) -> str:
        return os.environ["DEVELOP_POSTGRES_HOST"]

    @property
    def POSTGRES_PORT(self) -> int:
        return int(os.environ["DEVELOP_POSTGRES_CONTAINER_PORT"])

    @property
    def POSTGRES_USER(self) -> str:
        return os.environ["DEVELOP_POSTGRES_USER"]

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return os.environ["DEVELOP_POSTGRES_PASSWORD"]

    @property
    def POSTGRES_DB(self) -> str:
        return os.environ["DEVELOP_POSTGRES_DB"]


class ProductionPostgresConfig(PostgresConfig):
    @property
    def POSTGRES_HOST(self) -> str:
        return os.environ["PRODUCTION_POSTGRES_HOST"]

    @property
    def POSTGRES_PORT(self) -> int:
        return int(os.environ["PRODUCTION_POSTGRES_CONTAINER_PORT"])

    @property
    def POSTGRES_USER(self) -> str:
        return os.environ["PRODUCTION_POSTGRES_USER"]

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return os.environ["PRODUCTION_POSTGRES_PASSWORD"]

    @property
    def POSTGRES_DB(self) -> str:
        return os.environ["PRODUCTION_POSTGRES_DB"]


def get_postgres_config() -> PostgresConfig:
    env = get_app_config().APPLICATION_ENVIRONMENT
    if env == Env.DEVELOP:
        config = DevelopPostgresConfig()
    elif env == Env.PRODUCTION:
        config = ProductionPostgresConfig()
    else:
        raise NotImplementedError(f"postgres config not implemented for env={env}")
    return config
