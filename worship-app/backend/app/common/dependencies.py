from app.common.config.settings import settings
from app.domain.repository.post_repository import PostRepository
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository

if settings.USE_MEMORY_REPO:
    from app.infrastructure.db.repositories import (
        InMemoryPostRepository,
        InMemorySongRepository,
        InMemoryWorshipRepository,
    )

    _worship_repo = InMemoryWorshipRepository()
    _song_repo = InMemorySongRepository()
    _post_repo = InMemoryPostRepository()

    def get_worship_repo() -> WorshipRepository:
        return _worship_repo

    def get_song_repo() -> SongRepository:
        return _song_repo

    def get_post_repo() -> PostRepository:
        return _post_repo

else:
    from sqlalchemy.ext.asyncio import AsyncSession
    from fastapi import Depends
    from app.infrastructure.db.database import get_db
    from app.infrastructure.db.sqlalchemy_repositories import (
        SQLAlchemyPostRepository,
        SQLAlchemySongRepository,
        SQLAlchemyWorshipRepository,
    )

    def get_worship_repo(db: AsyncSession = Depends(get_db)) -> WorshipRepository:
        return SQLAlchemyWorshipRepository(db)

    def get_song_repo(db: AsyncSession = Depends(get_db)) -> SongRepository:
        return SQLAlchemySongRepository(db)

    def get_post_repo(db: AsyncSession = Depends(get_db)) -> PostRepository:
        return SQLAlchemyPostRepository(db)
