"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAddComment, useDeleteComment, useDeletePost, usePostDetail } from "@/hooks/usePost";
import {
  useBulkAddArrangements,
  useCreateWorship,
  useWorshipList,
} from "@/hooks/useWorship";
import type { Comment, Post, PostSong, Worship } from "@/types";

// ── 댓글 ──────────────────────────────────────────────────────────────────────
function CommentItem({ comment, postId }: { comment: Comment; postId: string }) {
  const { mutate: deleteComment } = useDeleteComment(postId);
  const date = new Date(comment.created_at).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-800">{comment.author_name}</span>
          <span className="text-xs text-gray-400">{date}</span>
        </div>
        <p className="text-sm text-gray-600">{comment.content}</p>
      </div>
      <button
        onClick={() => deleteComment(comment.id)}
        className="text-xs text-gray-300 hover:text-red-400 self-start pt-0.5"
      >
        삭제
      </button>
    </div>
  );
}

// ── 가져오기 모달 ──────────────────────────────────────────────────────────────
function ImportModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: worships, isLoading } = useWorshipList(0, 50);
  const { mutate: createWorship, isPending: creating } = useCreateWorship();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [targetWorshipId, setTargetWorshipId] = useState<string | null>(null);

  const { mutate: bulkAdd } = useBulkAddArrangements(targetWorshipId ?? "");

  function doImport(worshipId: string) {
    setTargetWorshipId(worshipId);
    setImporting(true);

    const items = post.songs.map((ps: PostSong, idx: number) => ({
      song_id: ps.song_id,
      order: idx,
      ment: ps.ment,
      song_form: [],
    }));

    // useBulkAddArrangements는 worshipId가 확정된 후에만 동작하므로
    // 직접 API 호출
    import("@/lib/api").then(({ apiClient }) => {
      apiClient
        .post(`/api/v1/worship/${worshipId}/arrangements/bulk`, items)
        .then(() => {
          setImporting(false);
          setDone(true);
          setTimeout(() => router.push(`/worship/${worshipId}`), 800);
        })
        .catch(() => {
          setImporting(false);
          alert("가져오기에 실패했습니다.");
        });
    });
  }

  function handleSelectExisting() {
    if (!selectedId) return;
    doImport(selectedId);
  }

  function handleNewWorship() {
    createWorship(
      {
        title: "가져온 콘티",
        scripture: post.scripture,
        sermon_direction: "",
        duration_minutes: 30,
        leader_meditation: "",
      } as Parameters<typeof createWorship>[0],
      {
        onSuccess: (newWorship: Worship) => {
          doImport(newWorship.id);
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <p className="text-lg font-semibold text-gray-800 mb-1">가져오기 완료!</p>
            <p className="text-sm text-gray-400">예배 페이지로 이동합니다...</p>
          </div>
        ) : importing || creating ? (
          <div className="text-center py-6">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">콘티를 가져오는 중...</p>
          </div>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">콘티 가져오기</h2>
            <p className="text-sm text-gray-400 mb-4">
              {post.songs.length}곡을 어느 예배에 추가할까요?
            </p>

            {/* 새 예배 만들기 */}
            <button
              onClick={handleNewWorship}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-primary-300 text-primary-600 hover:bg-primary-50 transition-colors mb-3 text-sm font-medium"
            >
              <span className="text-lg">+</span>
              새 예배 만들기
            </button>

            {/* 기존 예배 목록 */}
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">불러오는 중...</p>
            ) : worships && worships.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-2">기존 예배에 추가</p>
                {worships.map((w: Worship) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      selectedId === w.id
                        ? "border-primary-400 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800">{w.title}</p>
                    {w.scripture && (
                      <p className="text-xs text-primary-500 mt-0.5">{w.scripture}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">예배가 없습니다.</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
              >
                취소
              </button>
              {selectedId && (
                <button
                  onClick={handleSelectExisting}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                >
                  이 예배에 추가
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const { data: post, isLoading, isError } = usePostDetail(postId);
  const { mutate: deletePost } = useDeletePost();
  const { mutate: addComment, isPending: commentPending } = useAddComment(postId);

  const [showImport, setShowImport] = useState(false);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentContent, setCommentContent] = useState("");

  function handleDeletePost() {
    if (!confirm("게시글을 삭제하시겠습니까?")) return;
    deletePost(postId, { onSuccess: () => router.push("/community") });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentContent.trim()) return;
    addComment(
      { author_name: commentAuthor.trim(), content: commentContent.trim() },
      { onSuccess: () => setCommentContent("") }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-3">게시글을 불러올 수 없습니다.</p>
        <Link href="/community" className="text-primary-500 text-sm hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const date = new Date(post.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto">
      {showImport && <ImportModal post={post} onClose={() => setShowImport(false)} />}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/community" className="text-gray-400 hover:text-gray-600 text-sm">
          ← 커뮤니티
        </Link>
      </div>

      {/* 본문 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-semibold text-primary-600">{post.scripture}</p>
          <button onClick={handleDeletePost} className="text-xs text-gray-300 hover:text-red-400">
            삭제
          </button>
        </div>
        {post.meditation && (
          <p className="text-gray-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
            {post.meditation}
          </p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex gap-3 text-xs text-gray-400">
            <span>{post.author_name}</span>
            <span>{date}</span>
            <span>조회 {post.view_count}</span>
          </div>
        </div>
      </div>

      {/* 콘티 + 가져오기 */}
      {post.songs && post.songs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">콘티 ({post.songs.length}곡)</h3>
            <button
              onClick={() => setShowImport(true)}
              className="text-xs px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg font-medium transition-colors"
            >
              가져오기
            </button>
          </div>
          <ol className="space-y-2">
            {post.songs.map((ps: PostSong, idx: number) => (
              <li key={ps.id} className="flex items-start gap-3 text-sm">
                <span className="text-gray-400 w-4 shrink-0">{idx + 1}.</span>
                <div>
                  <span className="font-medium text-gray-800">{ps.song_title || ps.song_id}</span>
                  {ps.song_artist && (
                    <span className="text-gray-400 ml-2">{ps.song_artist}</span>
                  )}
                  {ps.ment && <p className="text-gray-500 text-xs mt-0.5">{ps.ment}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 댓글 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          댓글 {post.comments.length}
        </h3>
        {post.comments.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">첫 댓글을 남겨주세요.</p>
        ) : (
          <div className="mb-4">
            {post.comments.map((c) => (
              <CommentItem key={c.id} comment={c} postId={postId} />
            ))}
          </div>
        )}
        <form onSubmit={handleAddComment} className="space-y-2 pt-3 border-t border-gray-100">
          <input
            type="text"
            value={commentAuthor}
            onChange={(e) => setCommentAuthor(e.target.value)}
            placeholder="이름"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="댓글을 입력하세요"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="submit"
              disabled={commentPending}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
