"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreateSong, useDeleteSong, useSongList, useSongSearch } from "@/hooks/useSong";
import type { Song } from "@/types";

const KEY_OPTIONS = ["C", "D", "E", "F", "G", "A", "B", "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm"];
const CATEGORY_OPTIONS = ["찬양", "경배", "복음", "중창", "특송", "기타"];

function CreateSongModal({ onClose }: { onClose: () => void }) {
  const { mutate: createSong, isPending } = useCreateSong();
  const [form, setForm] = useState({
    title: "",
    artist: "",
    default_key: "C",
    bpm: 80,
    category: "찬양",
    lyrics: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSong(form, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">새 찬양 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">곡 제목 *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="예: 주님 다스리소서"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">아티스트 *</label>
              <input
                required
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="예: 어노인팅"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">기본 키</label>
              <select
                value={form.default_key}
                onChange={(e) => setForm({ ...form, default_key: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {KEY_OPTIONS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">BPM</label>
              <input
                type="number"
                min={40}
                max={240}
                value={form.bpm}
                onChange={(e) => setForm({ ...form, bpm: parseInt(e.target.value) || 80 })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">가사 전체</label>
              <textarea
                rows={6}
                value={form.lyrics}
                onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                placeholder="가사를 붙여넣어 주세요"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
            >
              {isPending ? "등록 중..." : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SongCard({ song }: { song: Song }) {
  const { mutate: deleteSong } = useDeleteSong();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm(`"${song.title}"을(를) 삭제하시겠습니까?`)) {
      deleteSong(song.id);
    }
  };

  return (
    <Link href={`/songs/${song.id}`} className="block">
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-200 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 truncate">{song.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{song.artist}</p>
          </div>
          <button
            onClick={handleDelete}
            className="flex-shrink-0 text-xs text-gray-300 hover:text-red-400 transition-colors px-1"
          >
            삭제
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded-full font-medium">
            {song.default_key}
          </span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
            {song.bpm} BPM
          </span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
            {song.category}
          </span>
          {song.sections.length > 0 && (
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">
              구간 {song.sections.length}개
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SongsPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: allSongs = [], isLoading } = useSongList(0, 100);
  const { data: searchResults = [] } = useSongSearch(search);

  const songs = search.trim() ? searchResults : allSongs;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">찬양 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">CCM 곡별 가사와 구간(송폼)을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 font-medium"
        >
          + 찬양 추가
        </button>
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="곡 제목 또는 아티스트로 검색"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 pl-9"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
      </div>

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
