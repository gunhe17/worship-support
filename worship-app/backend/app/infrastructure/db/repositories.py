"""
인메모리 Repository 구현 (개발/테스트용).
DB 연결이 완료되면 SQLAlchemy 기반으로 교체한다.
"""
from uuid import UUID

from app.domain.entity.post import Comment, Post, PostSong
from app.domain.entity.song import Song
from app.domain.entity.song_arrangement import SongArrangement
from app.domain.entity.song_section import SongSection
from app.domain.entity.song_sheet import SongSheet
from app.domain.entity.worship import Worship
from app.domain.repository.post_repository import PostRepository
from app.domain.repository.song_repository import SongRepository
from app.domain.repository.worship_repository import WorshipRepository


class InMemoryWorshipRepository(WorshipRepository):
    _store: dict[UUID, Worship] = {}
    _arrangements: dict[UUID, SongArrangement] = {}

    async def save(self, worship: Worship) -> Worship:
        self._store[worship.id] = worship
        return worship

    async def find_by_id(self, worship_id: UUID) -> Worship | None:
        return self._store.get(worship_id)

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Worship]:
        items = sorted(self._store.values(), key=lambda w: w.created_at, reverse=True)
        return items[skip : skip + limit]

    async def update(self, worship: Worship) -> Worship:
        self._store[worship.id] = worship
        return worship

    async def delete(self, worship_id: UUID) -> None:
        self._store.pop(worship_id, None)

    async def save_ai_result(self, worship_id: UUID, ai_result: dict) -> None:
        worship = self._store.get(worship_id)
        if worship:
            worship.ai_result = ai_result

    async def save_arrangement(self, arr: SongArrangement) -> SongArrangement:
        self._arrangements[arr.id] = arr
        return arr

    async def find_arrangements(self, worship_id: UUID) -> list[SongArrangement]:
        return sorted(
            [a for a in self._arrangements.values() if a.worship_id == worship_id],
            key=lambda a: a.order,
        )

    async def find_arrangement_by_id(self, arr_id: UUID) -> SongArrangement | None:
        return self._arrangements.get(arr_id)

    async def update_arrangement(self, arr: SongArrangement) -> SongArrangement:
        self._arrangements[arr.id] = arr
        return arr

    async def delete_arrangement(self, arr_id: UUID) -> None:
        self._arrangements.pop(arr_id, None)


class InMemorySongRepository(SongRepository):
    _store: dict[UUID, Song] = {}
    _sections: dict[UUID, SongSection] = {}
    _sheets: dict[UUID, SongSheet] = {}

    async def save(self, song: Song) -> Song:
        self._store[song.id] = song
        return song

    async def find_by_id(self, song_id: UUID) -> Song | None:
        return self._store.get(song_id)

    async def find_all(self, skip: int = 0, limit: int = 20) -> list[Song]:
        items = list(self._store.values())
        return items[skip : skip + limit]

    async def search(self, keyword: str) -> list[Song]:
        kw = keyword.lower()
        kw_no_space = kw.replace(" ", "")
        return [
            s for s in self._store.values()
            if kw in s.title.lower()
            or kw in s.artist.lower()
            or kw_no_space in s.title.lower().replace(" ", "")
            or kw_no_space in s.artist.lower().replace(" ", "")
        ]

    async def update(self, song: Song) -> Song:
        self._store[song.id] = song
        return song

    async def delete(self, song_id: UUID) -> None:
        self._store.pop(song_id, None)

    async def find_sections(self, song_id: UUID) -> list[SongSection]:
        return sorted(
            [s for s in self._sections.values() if s.song_id == song_id],
            key=lambda s: s.order,
        )

    async def save_section(self, section: SongSection) -> SongSection:
        self._sections[section.id] = section
        return section

    async def update_section(self, section: SongSection) -> SongSection:
        self._sections[section.id] = section
        return section

    async def delete_section(self, section_id: UUID) -> None:
        self._sections.pop(section_id, None)

    async def find_section_by_id(self, section_id: UUID) -> SongSection | None:
        return self._sections.get(section_id)

    async def reorder_sections(self, song_id: UUID, section_ids: list[UUID]) -> list[SongSection]:
        for i, section_id in enumerate(section_ids):
            if section_id in self._sections:
                self._sections[section_id].order = i
        return await self.find_sections(song_id)

    async def find_sheets(self, song_id: UUID) -> list[SongSheet]:
        return sorted(
            [s for s in self._sheets.values() if s.song_id == song_id],
            key=lambda s: (s.key, s.page_order),
        )

    async def save_sheet(self, sheet: SongSheet) -> SongSheet:
        self._sheets[sheet.id] = sheet
        return sheet

    async def find_sheet_by_id(self, sheet_id: UUID) -> SongSheet | None:
        return self._sheets.get(sheet_id)

    async def delete_sheet(self, sheet_id: UUID) -> None:
        self._sheets.pop(sheet_id, None)

    async def delete_sheets_by_key(self, song_id: UUID, key: str) -> None:
        to_delete = [
            sid for sid, s in self._sheets.items()
            if s.song_id == song_id and s.key == key
        ]
        for sid in to_delete:
            self._sheets.pop(sid, None)


class InMemoryPostRepository(PostRepository):
    _posts: dict[UUID, Post] = {}
    _post_songs: dict[UUID, PostSong] = {}
    _comments: dict[UUID, Comment] = {}

    async def save(self, post: Post) -> Post:
        self._posts[post.id] = post
        return post

    async def find_by_id(self, post_id: UUID) -> Post | None:
        return self._posts.get(post_id)

    async def find_all(self, skip: int, limit: int, order_by: str) -> list[Post]:
        posts = list(self._posts.values())
        if order_by == "view":
            posts.sort(key=lambda p: p.view_count, reverse=True)
        else:
            posts.sort(key=lambda p: p.created_at, reverse=True)
        return posts[skip: skip + limit]

    async def increment_view(self, post_id: UUID) -> None:
        if post_id in self._posts:
            self._posts[post_id].view_count += 1

    async def delete(self, post_id: UUID) -> None:
        self._posts.pop(post_id, None)

    async def save_post_song(self, post_song: PostSong) -> PostSong:
        self._post_songs[post_song.id] = post_song
        return post_song

    async def find_post_songs(self, post_id: UUID) -> list[PostSong]:
        return sorted(
            [ps for ps in self._post_songs.values() if ps.post_id == post_id],
            key=lambda ps: ps.order,
        )

    async def delete_post_song(self, post_song_id: UUID) -> None:
        self._post_songs.pop(post_song_id, None)

    async def reorder_post_songs(self, post_id: UUID, song_ids: list[UUID]) -> list[PostSong]:
        for i, ps_id in enumerate(song_ids):
            if ps_id in self._post_songs:
                self._post_songs[ps_id].order = i
        return await self.find_post_songs(post_id)

    async def save_comment(self, comment: Comment) -> Comment:
        self._comments[comment.id] = comment
        return comment

    async def find_comments(self, post_id: UUID) -> list[Comment]:
        return sorted(
            [c for c in self._comments.values() if c.post_id == post_id],
            key=lambda c: c.created_at,
        )

    async def delete_comment(self, comment_id: UUID) -> None:
        self._comments.pop(comment_id, None)
