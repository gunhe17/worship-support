"use client";

import { useParams, useRouter } from "next/navigation";
import { useWorshipDetail, useDeleteWorship } from "@/hooks/useWorship";
import { useFullRecommend } from "@/hooks/useRecommend";
import { SongRecommendCard } from "@/components/ai/SongRecommendCard";
import { ScriptureAnalysisCard } from "@/components/ai/ScriptureAnalysisCard";
import Link from "next/link";

export default function WorshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: worship, isLoading: worshipLoading } = useWorshipDetail(id);
  const { mutate: deleteWorship } = useDeleteWorship();

  // 예배 데이터가 로드되면 자동으로 전체 분석 시작 (15분 캐시 적용)
  const {
    data: recommend,
    isLoading: isAnalyzing,
    isError,
    error,
    refetch,
  } = useFullRecommend(
    worship
      ? {
          worship_id: worship.id,
          scripture: worship.scripture,
          sermon_direction: worship.sermon_direction ?? "",
          duration_minutes: worship.duration_minutes ?? 30,
        }
      : null
  );

  if (worshipLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (!worship) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">예배를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm("이 예배를 삭제하시겠습니까?")) {
      deleteWorship(id, { onSuccess: () => router.push("/worship") });
    }
  };

  const totalMin = worship.duration_minutes ?? 30;

  return (
    <div className="max-w-2xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600">
          ← 목록으로
        </button>
        <div className="flex items-center gap-3">
          <Link
            href={`/worship/${id}/lead`}
            className="text-sm px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
          >
            🎤 인도 모드
          </Link>
          <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600">
            삭제
          </button>
        </div>
      </div>

      {/* 예배 정보 카드 */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 space-y-3">
        <h1 className="text-xl font-bold text-primary-900">{worship.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-primary-700">{worship.scripture}</span>
          {worship.sermon_direction && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full">설교 방향성 있음</span>
          )}
          <span className="px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full">
            총 {totalMin}분 예배
          </span>
        </div>
        <p className="text-xs text-primary-400">
          생성일: {new Date(worship.created_at).toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* 분석 중 상태 */}
      {isAnalyzing && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
          <div>
            <p className="font-medium text-gray-700">AI가 예배를 분석하고 있습니다</p>
            <p className="text-sm text-gray-400 mt-1">
              본문 분석 → 찬양 선곡 → YouTube 검색 순서로 진행됩니다
            </p>
          </div>
          <p className="text-xs text-gray-300">보통 20~40초 소요됩니다</p>
        </div>
      )}

      {/* 오류 상태 */}
      {isError && !isAnalyzing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
          <p className="text-sm text-red-700 font-medium">AI 분석 중 오류가 발생했습니다</p>
          <p className="text-xs text-red-500">
            {(error as any)?.response?.data?.message ?? "서버가 실행 중인지 확인해 주세요."}
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 분석 결과 */}
      {recommend && (
        <>
          {/* 본문 분석 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">본문 분석</h2>
            <ScriptureAnalysisCard analysis={recommend.analysis} />
          </div>

          {/* 찬양 목록 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                AI 추천 찬양 목록
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>총 {recommend.recommendations.length}곡</span>
                {recommend.total_estimated_duration > 0 && (
                  <span>/ 약 {recommend.total_estimated_duration}분</span>
                )}
              </div>
            </div>

            {/* 분위기 패턴 안내 */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">느린곡</span>
              <span className="text-gray-300">→</span>
              <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full">빠른곡</span>
              <span className="text-gray-300">→</span>
              <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full">빠른곡</span>
              <span className="text-gray-300">→</span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">느린곡</span>
              <span className="text-gray-300">→</span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">느린곡</span>
            </div>

            <div className="space-y-3">
              {recommend.recommendations.map((song, i) => (
                <SongRecommendCard key={i} song={song} rank={i + 1} />
              ))}
            </div>

            <button
              onClick={() => refetch()}
              className="w-full py-2 text-sm text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              다른 찬양으로 다시 추천받기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
