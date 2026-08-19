from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entity.post import Comment, Post, PostSong


class PostRepository(ABC):
    @abstractmethod
    async def save(self, post: Post) -> Post: ...

    @abstractmethod
    async def find_by_id(self, post_id: UUID) -> Post | None: ...

    @abstractmethod
    async def find_all(self, skip: int, limit: int, order_by: str) -> list[Post]: ...

    @abstractmethod
    async def increment_view(self, post_id: UUID) -> None: ...

    @abstractmethod
    async def delete(self, post_id: UUID) -> None: ...

    # 콘티 곡
    @abstractmethod
    async def save_post_song(self, post_song: PostSong) -> PostSong: ...

    @abstractmethod
    async def find_post_songs(self, post_id: UUID) -> list[PostSong]: ...

    @abstractmethod
    async def delete_post_song(self, post_song_id: UUID) -> None: ...

    @abstractmethod
    async def reorder_post_songs(self, post_id: UUID, song_ids: list[UUID]) -> list[PostSong]: ...

    # 댓글
    @abstractmethod
    async def save_comment(self, comment: Comment) -> Comment: ...

    @abstractmethod
    async def find_comments(self, post_id: UUID) -> list[Comment]: ...

    @abstractmethod
    async def delete_comment(self, comment_id: UUID) -> None: ...
