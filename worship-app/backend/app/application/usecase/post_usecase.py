from uuid import UUID

from app.common.exception.exceptions import raise_app_error
from app.domain.entity.post import Comment, Post, PostSong
from app.domain.repository.post_repository import PostRepository
from app.presentation.dto.post_dto import (
    CommentCreateRequest,
    CommentResponse,
    PostCreateRequest,
    PostResponse,
    PostSongCreateRequest,
    PostSongResponse,
    PostSummaryResponse,
    PostUpdateRequest,
)


def _to_post_song_response(ps: PostSong) -> PostSongResponse:
    return PostSongResponse(
        id=ps.id,
        post_id=ps.post_id,
        song_id=ps.song_id,
        order=ps.order,
        ment=ps.ment,
    )


def _to_comment_response(c: Comment) -> CommentResponse:
    return CommentResponse(
        id=c.id,
        post_id=c.post_id,
        author_name=c.author_name,
        content=c.content,
        created_at=c.created_at,
    )


def _to_post_response(post: Post, songs: list[PostSong], comments: list[Comment]) -> PostResponse:
    return PostResponse(
        id=post.id,
        author_name=post.author_name,
        scripture=post.scripture,
        meditation=post.meditation,
        view_count=post.view_count,
        created_at=post.created_at,
        songs=[_to_post_song_response(s) for s in songs],
        comments=[_to_comment_response(c) for c in comments],
    )


class PostUsecase:
    def __init__(self, repo: PostRepository):
        self._repo = repo

    async def create(self, req: PostCreateRequest) -> PostResponse:
        post = Post(
            author_name=req.author_name,
            scripture=req.scripture,
            meditation=req.meditation,
        )
        saved = await self._repo.save(post)
        songs = []
        for i, s in enumerate(req.songs):
            ps = PostSong(post_id=saved.id, song_id=s.song_id, order=i, ment=s.ment)
            saved_ps = await self._repo.save_post_song(ps)
            songs.append(saved_ps)
        return _to_post_response(saved, songs, [])

    async def list_all(self, skip: int, limit: int, order_by: str) -> list[PostSummaryResponse]:
        posts = await self._repo.find_all(skip, limit, order_by)
        result = []
        for post in posts:
            songs = await self._repo.find_post_songs(post.id)
            comments = await self._repo.find_comments(post.id)
            result.append(PostSummaryResponse(
                id=post.id,
                author_name=post.author_name,
                scripture=post.scripture,
                meditation=post.meditation,
                view_count=post.view_count,
                created_at=post.created_at,
                song_count=len(songs),
                comment_count=len(comments),
            ))
        return result

    async def get(self, post_id: UUID) -> PostResponse:
        post = await self._repo.find_by_id(post_id)
        if not post:
            raise_app_error("POST_NOT_FOUND")
        await self._repo.increment_view(post_id)
        post.view_count += 1
        songs = await self._repo.find_post_songs(post_id)
        comments = await self._repo.find_comments(post_id)
        return _to_post_response(post, songs, comments)

    async def update(self, post_id: UUID, req: PostUpdateRequest) -> PostResponse:
        post = await self._repo.find_by_id(post_id)
        if not post:
            raise_app_error("POST_NOT_FOUND")
        if req.scripture is not None:
            post.scripture = req.scripture
        if req.meditation is not None:
            post.meditation = req.meditation
        await self._repo.save(post)
        songs = await self._repo.find_post_songs(post_id)
        comments = await self._repo.find_comments(post_id)
        return _to_post_response(post, songs, comments)

    async def delete(self, post_id: UUID) -> None:
        post = await self._repo.find_by_id(post_id)
        if not post:
            raise_app_error("POST_NOT_FOUND")
        await self._repo.delete(post_id)

    async def add_song(self, post_id: UUID, req: PostSongCreateRequest) -> PostSongResponse:
        post = await self._repo.find_by_id(post_id)
        if not post:
            raise_app_error("POST_NOT_FOUND")
        existing = await self._repo.find_post_songs(post_id)
        ps = PostSong(post_id=post_id, song_id=req.song_id, order=len(existing), ment=req.ment)
        saved = await self._repo.save_post_song(ps)
        return _to_post_song_response(saved)

    async def remove_song(self, post_song_id: UUID) -> None:
        await self._repo.delete_post_song(post_song_id)

    async def reorder_songs(self, post_id: UUID, song_ids: list[UUID]) -> list[PostSongResponse]:
        songs = await self._repo.reorder_post_songs(post_id, song_ids)
        return [_to_post_song_response(s) for s in songs]

    async def add_comment(self, post_id: UUID, req: CommentCreateRequest) -> CommentResponse:
        post = await self._repo.find_by_id(post_id)
        if not post:
            raise_app_error("POST_NOT_FOUND")
        comment = Comment(post_id=post_id, author_name=req.author_name, content=req.content)
        saved = await self._repo.save_comment(comment)
        return _to_comment_response(saved)

    async def delete_comment(self, comment_id: UUID) -> None:
        await self._repo.delete_comment(comment_id)
