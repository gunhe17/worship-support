"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorshipDetail } from "@/hooks/useWorship";
import { useFullRecommend } from "@/hooks/useRecommend";
import { useWorshipMents } from "@/hooks/useWorshipMent";
import { MentEditor } from "@/components/worship/MentEditor";
import { Teleprompter } from "@/components/worship/Teleprompter";

type View = "prepare" | "edit" | "lead";

export default function WorshipLeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [view, setView] = useState<View>("prepare");

  const { data: worship, isLoading: worshipLoading } = useWorshipDetail(id);
  const { data: recommend } = useFullRecommend(
    worship
      ? {
          worship_id: worship.id,
          scripture: worship.scripture,
          sermon_direction: worship.sermon_direction ?? "",
          duration_minutes: worship.duration_minutes ?? 30,
        }
      : null
  );
  const { data: mentData, isLoading: mentsLoading } = useWorshipMents(id);

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

  const songs = recommend?.recommendations ?? [];
  const ments = mentData?.ments ?? [];
  const hasMents = ments.some((m) => m.ment_text.trim() !== "");

  if (view === "lead") {
    return (
      <Teleprompter
        ments={ments}
        onExit={() => setView("prepare")}
      />
    );
  }

  if (view === "edit") {
    return (
      <div className="max-w-2xl space-y-4">
        <button
          onClick={() => setView("prepare")}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← 돌아가기
        </button>
        <MentEditor
          worship={worship}
          songs={songs}
          onClose={() => setView("prepare")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/worship/${id}`)}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← 예배 상세로
        </button>
      </div>

      {/* 예배 정보 */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 space-y-2">
        <h1 className="text-xl font-bold text-primary-900">{worship.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-primary-700">{worship.scripture}</span>
          {worship.sermon_direction && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full">
              설교 방향성 있음
            </span>
          )}
        </div>
      </div>

      {/* 인도 준비 상태 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-gray-800">인도 준비</h2>

        {/* 찬양 목록 확인 */}
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              songs.length > 0 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
            }`}
          >
            {songs.length > 0 ? "✓" : "1"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">찬양 목록</p>
            <p className="text-xs text-gray-400">
              {songs.length > 0
                ? `${songs.length}곡 준비됨 (${songs.map((s) => s.title).join(", ")})`
                : "예배 상세 페이지에서 AI 추천을 먼저 받아주세요"}
            </p>
          </div>
        </div>

        {/* 멘트 작성 상태 */}
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              hasMents ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
            }`}
          >
            {hasMents ? "✓" : "2"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">멘트 작성</p>
            <p className="text-xs text-gray-400">
              {mentsLoading
                ? "불러오는 중..."
                : hasMents
                ? `${ments.filter((m) => m.ment_text).length}개 멘트 작성됨`
                : "멘트를 아직 작성하지 않았습니다"}
            </p>
          </div>
          <button
            onClick={() => setView("edit")}
            className="text-xs px-3 py-1.5 border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50"
          >
            {hasMents ? "수정" : "작성하기"}
          </button>
        </div>
      </div>

      {/* 멘트 미리보기 */}
      {ments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">멘트 미리보기</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ments.map((ment, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <div>
                  <span className="text-xs text-primary-500">[{ment.section_label}] </span>
                  <span className={ment.ment_text ? "text-gray-700" : "text-gray-300 italic"}>
                    {ment.ment_text || "(멘트 없음)"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 인도 시작 버튼 */}
      <button
        onClick={() => setView("lead")}
        disabled={ments.length === 0}
        className="w-full py-4 rounded-xl bg-primary-500 text-white font-semibold text-lg hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {ments.length === 0 ? "멘트를 먼저 작성해주세요" : "인도 시작 →"}
      </button>

      <p className="text-center text-xs text-gray-400">
        인도 중에는 ← → 방향키나 스페이스바로 멘트를 넘길 수 있습니다
      </p>
    </div>
  );
}
