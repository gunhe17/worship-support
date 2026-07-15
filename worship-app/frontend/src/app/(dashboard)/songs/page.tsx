"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Song } from "@/types";

export default function SongsPage() {
  const [keyword, setKeyword] = useState("");

  const { data: songs, isLoading } = useQuery<Song[]>({
    queryKey: ["songs", keyword],
    queryFn: () =>
      apiClient
        .get(keyword ? "/api/v1/songs/search" : "/api/v1/songs", {
          params: keyword ? { q: keyword } : {},
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">찬양 목록</h1>
      </div>

      <input
        type="text"
        placeholder="제목 또는 아티스트 검색..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {isLoading ? (
        <p className="text-center text-gray-400 py-20">찬양 목록을 불러오는 중...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {songs?.map((song) => (
            <div key={song.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-medium text-gray-900">{song.title}</p>
                <p className="text-sm text-gray-400">{song.artist}</p>
              </div>
              <div className="flex gap-3 text-sm text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">{song.default_key}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">{song.bpm} BPM</span>
              </div>
            </div>
          ))}
          {!songs?.length && (
            <p className="text-center text-gray-400 py-12">검색 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
