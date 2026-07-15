from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Worship Support"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    USE_MEMORY_REPO: bool = False

    # Database (Supabase)
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # AI (Claude)
    ANTHROPIC_API_KEY: str

    # YouTube
    YOUTUBE_API_KEY: str

    # Storage (S3 or MinIO)
    STORAGE_TYPE: str = "minio"
    S3_BUCKET_NAME: str = "worship-support"
    S3_ENDPOINT_URL: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
