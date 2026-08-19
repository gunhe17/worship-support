from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.application.usecase.post_usecase import PostUsecase
from app.common.dependencies import get_post_repo
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

router = APIRouter(prefix="/api/v1/posts", tags=["Community"])


def get_usecase(repo: PostRepository = Depends(get_post_repo)) -> PostUsecase:
    return PostUsecase(repo)


@router.post("", response_model=PostResponse, status_code=201)
async def create_post(
    body: PostCreateRequest,
    usecase: PostUsecase = Depends(get_usecase),
) -> PostResponse:
    return await usecase.create(body)


@router.get("", response_model=list[PostSummaryResponse])
async def list_posts(
    skip: int = 0,
    limit: int = 20,
    order_by: str = Query("latest", description="latest | view"),
    usecase: PostUsecase = Depends(get_usecase),
) -> list[PostSummaryResponse]:
    return await usecase.list_all(skip, limit, order_by)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: UUID,
    usecase: PostUsecase = Depends(get_usecase),
) -> PostResponse:
    return await usecase.get(post_id)


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: UUID,
    body: PostUpdateRequest,
    usecase: PostUsecase = Depends(get_usecase),
) -> PostResponse:
    return await usecase.update(post_id, body)


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    usecase: PostUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete(post_id)


# ── 콘티 곡 ──────────────────────────────────────────────────────────────────

@router.post("/{post_id}/songs", response_model=PostSongResponse, status_code=201)
async def add_song(
    post_id: UUID,
    body: PostSongCreateRequest,
    usecase: PostUsecase = Depends(get_usecase),
) -> PostSongResponse:
    return await usecase.add_song(post_id, body)


@router.delete("/{post_id}/songs/{post_song_id}", status_code=204)
async def remove_song(
    post_id: UUID,
    post_song_id: UUID,
    usecase: PostUsecase = Depends(get_usecase),
) -> None:
    await usecase.remove_song(post_song_id)


@router.put("/{post_id}/songs/reorder", response_model=list[PostSongResponse])
async def reorder_songs(
    post_id: UUID,
    body: list[UUID],
    usecase: PostUsecase = Depends(get_usecase),
) -> list[PostSongResponse]:
    return await usecase.reorder_songs(post_id, body)


# ── 댓글 ─────────────────────────────────────────────────────────────────────

@router.post("/{post_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    post_id: UUID,
    body: CommentCreateRequest,
    usecase: PostUsecase = Depends(get_usecase),
) -> CommentResponse:
    return await usecase.add_comment(post_id, body)


@router.delete("/{post_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    post_id: UUID,
    comment_id: UUID,
    usecase: PostUsecase = Depends(get_usecase),
) -> None:
    await usecase.delete_comment(comment_id)
