from abc import ABC, abstractmethod
import os


# #
# APP

def get_environment() -> str:
    ENVIRONMENT = os.getenv("ENVIRONMENT", "")

    if ENVIRONMENT not in ["develop", "production"]:
        raise Exception("ENVIRONMENT is not valid")
    
    return ENVIRONMENT

# #
# DB

class BaseDatabaseConfig(ABC):
    @property
    @abstractmethod
    def POSTGRES_USER(self) -> str:
        pass

    @property
    @abstractmethod
    def POSTGRES_PASSWORD(self) -> str:
        pass

    @property
    @abstractmethod
    def POSTGRES_HOST(self) -> str:
        pass

    @property
    @abstractmethod
    def POSTGRES_PORT(self) -> str:
        pass

    @property
    @abstractmethod
    def POSTGRES_DB(self) -> str:
        pass

    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

class TestDatabaseConfig(BaseDatabaseConfig):
    @property
    def POSTGRES_USER(self) -> str:
        return os.getenv("TEST_POSTGRES_USER", "test_user")

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return os.getenv("TEST_POSTGRES_PASSWORD", "test_password")

    @property
    def POSTGRES_HOST(self) -> str:
        return os.getenv("TEST_POSTGRES_HOST", "database-test")

    @property
    def POSTGRES_PORT(self) -> str:
        return os.getenv("TEST_POSTGRES_CONTAINER_PORT", "5432")

    @property
    def POSTGRES_DB(self) -> str:
        return os.getenv("TEST_POSTGRES_DB", "test_db")

class DevDatabaseConfig(BaseDatabaseConfig):
    @property
    def POSTGRES_USER(self) -> str:
        return os.getenv("DEVELOP_POSTGRES_USER", "test_user")

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return os.getenv("DEVELOP_POSTGRES_PASSWORD", "develop_password")

    @property
    def POSTGRES_HOST(self) -> str:
        return os.getenv("DEVELOP_POSTGRES_HOST", "database")

    @property
    def POSTGRES_PORT(self) -> str:
        return os.getenv("DEVELOP_POSTGRES_CONTAINER_PORT", "5432")

    @property
    def POSTGRES_DB(self) -> str:
        return os.getenv("DEVELOP_POSTGRES_DB", "develop_db")

class ProdDatabaseConfig(BaseDatabaseConfig):
    @property
    def POSTGRES_USER(self) -> str:
        return os.getenv("PRODUCTION_POSTGRES_USER", "user")

    @property
    def POSTGRES_PASSWORD(self) -> str:
        return os.getenv("PRODUCTION_POSTGRES_PASSWORD", "password")

    @property
    def POSTGRES_HOST(self) -> str:
        return os.getenv("PRODUCTION_POSTGRES_HOST", "localhost")

    @property
    def POSTGRES_PORT(self) -> str:
        return os.getenv("PRODUCTION_POSTGRES_PORT", "5432")

    @property
    def POSTGRES_DB(self) -> str:
        return os.getenv("PRODUCTION_POSTGRES_DB", "db")

def get_database_config(environment: str = get_environment()) -> BaseDatabaseConfig:
    if environment == "test":
        return TestDatabaseConfig()
    
    elif environment == "develop":
        return DevDatabaseConfig()
    
    elif environment == "production":
        return ProdDatabaseConfig()
    
    else:
        raise Exception("ENVIRONMENT is not valid")