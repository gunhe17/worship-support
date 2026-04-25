from __future__ import annotations

import os
from pathlib import Path


class Settings:
    access_token_secret: str
    database_path: str

    def __init__(self) -> None:
        self.access_token_secret = os.getenv(
            "ACCESS_TOKEN_SECRET",
            "development-access-token-secret",
        )
        default_database_path = Path(__file__).resolve().parents[2] / "data" / "app.db"
        self.database_path = os.getenv("DATABASE_PATH", str(default_database_path))


settings = Settings()
