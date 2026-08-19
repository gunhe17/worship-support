"use client";

import Link from "next/link";
import { useState } from "react";
import { usePostList } from "@/hooks/usePost";
import type { PostSummary } from "@/types";

function PostCard({ post }: { post: PostSummary }) {
  const date = new Date(post.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link href={`/community/${post.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-primary-500 font-medium">{post.scripture}</p>
          <span className="text-xs text-gray-400 shrink-0">조회 {post.view_count}</span>
        </div>
        {post.meditation && (
          <p className="text-sm text-gray-700 mb-3 line-clamp-2">{post.meditation}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex gap-3">
            <span>{post.author_name}</span>
            <span>찬양 {post.song_count}곡</span>
            <span>댓글 {post.comment_count}</span>
          </div>
          <span>{date}</span>
        </div>
      </div>
    </Link>
  );
}

export default function CommunityPage() {
  const [orderBy, setOrderBy] = useState<"latest" | "view">("latest");
  const { data: posts, isLoading, isError, refetch } = usePostList(0, 50, orderBy);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-400">서버에 연결할 수 없습니다.</p>
        <button onClick={() => refetch()} className="text-sm text-primary-500 hover:underline">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">불편한 커뮤니티</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setOrderBy("latest")}
              className={`px-3 py-1.5 transition-colors ${
                orderBy === "latest" ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              최신순
            </button>
            <button
              onClick={() => setOrderBy("view")}
              className={`px-3 py-1.5 transition-colors ${
                orderBy === "view" ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              조회순
            </button>
          </div>
          <Link
            href="/community/new"
            className="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            글쓰기
          </Link>
        </div>
      </div>

      {!posts || posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-2">아직 게시글이 없습니다.</p>
          <Link href="/community/new" className="text-primary-500 text-sm hover:underline">
            첫 번째 글을 작성해보세요
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
