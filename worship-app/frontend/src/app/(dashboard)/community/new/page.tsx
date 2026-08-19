"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreatePost } from "@/hooks/usePost";

export default function NewPostPage() {
  const router = useRouter();
  const [authorName, setAuthorName] = useState("");
  const [scripture, setScripture] = useState("");
  const [meditation, setMeditation] = useState("");
  const [error, setError] = useState("");

  const { mutate: createPost, isPending } = useCreatePost();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !scripture.trim()) {
      setError("이름과 본문 말씀은 필수입니다.");
      return;
    }
    setError("");
    createPost(
      { author_name: authorName.trim(), scripture: scripture.trim(), meditation: meditation.trim() },
      {
        onSuccess: (data) => router.push(`/community/${data.id}`),
        onError: () => setError("게시글 작성에 실패했습니다."),
      }
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← 돌아가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900">글쓰기</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="작성자 이름"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">본문 말씀</label>
          <input
            type="text"
            value={scripture}
            onChange={(e) => setScripture(e.target.value)}
            placeholder="예: 요한복음 15:1-8"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">묵상 나눔</label>
          <textarea
            value={meditation}
            onChange={(e) => setMeditation(e.target.value)}
            placeholder="말씀을 통해 받은 은혜, 찬양 선택 이유 등을 자유롭게 나눠주세요."
            rows={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "등록 중..." : "게시글 등록"}
        </button>
      </form>
    </div>
  );
}
