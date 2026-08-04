"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateSong, useDeleteSong, useSongList, useSongSearch } from "@/hooks/useSong";
import type { Song } from "@/types";

function CreateSongModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { mutate: createSong, isPending } = useCreateSong();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createSong(
      { title, artist: artist || "미상", default_key: "C", bpm: 80, category: "찬양", lyrics: "" },
      {
        onSuccess: (song) => {
          onClose();
          router.push(`/songs/${song.id}`);
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.detail ??
            err?.response?.data?.message ??
            err?.message ??
            "서버 연결 오류";
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">새 찬양 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">곡 제목 *</label>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="예: 주님 다스리소서"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">아티스트</label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="예: 마커스워십 (선택)"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              취소
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="px-5 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
            >
              {isPending ? "추가 중..." : "추가하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SongCard({ song }: { song: Song }) {
  const { mutate: deleteSong } = useDeleteSong();

  return (
    <Link href={`/songs/${song.id}`} className="block group">
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-200 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 truncate group-hover:text-primary-600 transition-colors">
              {song.title}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">{song.artist}</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (confirm(`"${song.title}"을(를) 삭제하시겠습니까?`)) deleteSong(song.id);
            }}
            className="flex-shrink-0 text-xs text-gray-300 hover:text-red-400 transition-colors px-1"
          >
            삭제
          </button>
        </div>
        {song.sections.length > 0 && (
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {song.sections
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <span key={s.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                  {s.section_type}
                </span>
              ))}
          </div>
        )}
        {song.sections.length === 0 && (
          <p className="text-xs text-gray-300 mt-3">가사 · 구간 미입력</p>
        )}
      </div>
    </Link>
  );
}

export default function SongsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: allSongs = [], isLoading } = useSongList(0, 200);
  const { data: searchResults = [] } = useSongSearch(search);

  const songs = search.trim() ? searchResults : allSongs;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">찬양 DB</h1>
          <p className="text-sm text-gray-400 mt-0.5">곡별 가사와 구간을 정리합니다</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 font-medium"
        >
          + 찬양 추가
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="곡 제목 또는 아티스트 검색"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 space-y-2">
          <p className="text-gray-400 text-sm">
            {search ? "검색 결과가 없습니다" : "등록된 찬양이 없습니다"}
          </p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="text-primary-500 text-sm hover:underline">
              첫 번째 찬양 등록하기 →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}

      {showCreate && <CreateSongModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
