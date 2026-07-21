"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorshipMentItem } from "@/types";

interface TeleprompterProps {
  ments: WorshipMentItem[];
  onExit: () => void;
}

// 섹션 레이블에서 표시용 텍스트 추출
function formatSectionLabel(label: string): string {
  // "Chorus(16마디) → Bridge(8마디)" → "Chorus → Bridge"
  return label.replace(/\(\d+마디\)/g, "").replace(/\s+/g, " ").trim();
}

// 현재/이전/다음 라벨 분리
function getSectionParts(label: string): { from: string; to: string } | null {
  const clean = formatSectionLabel(label);
  if (!clean.includes("→")) return null;
  const [from, ...rest] = clean.split(" → ");
  return { from: from.trim(), to: rest.join(" → ").trim() };
}

export function Teleprompter({ ments, onExit }: TeleprompterProps) {
  const [current, setCurrent] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    setCurrent((prev) => Math.min(prev + 1, ments.length - 1));
  }, [ments.length]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onExit]);

  const currentMent = ments[current];
  const prevPrevMent = current > 1 ? ments[current - 2] : null;
  const prevMent = current > 0 ? ments[current - 1] : null;
  const nextMent = current < ments.length - 1 ? ments[current + 1] : null;
  const nextNextMent = current < ments.length - 2 ? ments[current + 2] : null;

  // 곡별로 멘트를 그룹화해서 현재 곡 내 진행 상황 계산
  const currentSongTitle = currentMent?.song_title ?? "";
  const songMentIndices = ments
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.song_title === currentSongTitle);
  const posInSong = songMentIndices.findIndex(({ i }) => i === current);

  // 고유 곡 목록 (순서 유지)
  const songOrder = ments.reduce<string[]>((acc, m) => {
    if (!acc.includes(m.song_title)) acc.push(m.song_title);
    return acc;
  }, []);
  const currentSongIdx = songOrder.indexOf(currentSongTitle);

  const sectionParts = currentMent ? getSectionParts(currentMent.section_label) : null;
  const isFirst = current === 0;
  const isLast = current === ments.length - 1;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col select-none">

      {/* ── 상단 바 ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-semibold tracking-widest uppercase">Live</span>
        </div>

        {/* 곡 진행 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {songOrder.map((title, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentSongIdx
                  ? "w-6 bg-primary-400"
                  : i < currentSongIdx
                  ? "w-3 bg-gray-600"
                  : "w-3 bg-gray-700"
              }`}
              title={title}
            />
          ))}
        </div>

        <button onClick={onExit} className="text-gray-600 hover:text-gray-400 text-xs">
          ESC 종료
        </button>
      </div>

      {/* ── 현재 곡 정보 ── */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest mb-0.5">
              {currentSongIdx + 1} / {songOrder.length} 번째 찬양
            </p>
            <h2 className="text-white text-xl font-bold">{currentSongTitle}</h2>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">{current + 1} / {ments.length}</p>
            <p className="text-gray-600 text-xs mt-0.5">
              {posInSong + 1} / {songMentIndices.length} 포인트
            </p>
          </div>
        </div>

        {/* 섹션 진행 타임라인 */}
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {songMentIndices.map(({ m, i }, j) => {
            const isCurrent = i === current;
            const isPast = i < current;
            const parts = getSectionParts(m.section_label);
            const label = parts ? parts.from : m.section_label.replace(/\(\d+마디\)/g, "").trim();
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`flex items-center gap-1 transition-all duration-200 ${
                  isCurrent ? "opacity-100" : isPast ? "opacity-40" : "opacity-25"
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isCurrent
                      ? "bg-primary-500 text-white"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {label}
                </span>
                {j < songMentIndices.length - 1 && (
                  <span className="text-gray-700 text-xs">›</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 메인 멘트 영역 ── */}
      <div ref={mainRef} className="flex-1 flex flex-col justify-center px-6 gap-3 overflow-hidden">

        {/* 이전이전 멘트 (매우 희미) */}
        {prevPrevMent ? (
          <div className="opacity-15 transition-all duration-300">
            <p className="text-xs text-gray-700 mb-0.5 truncate">
              {formatSectionLabel(prevPrevMent.section_label)}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed line-clamp-1">
              {prevPrevMent.ment_text || "(멘트 없음)"}
            </p>
          </div>
        ) : <div className="h-8" />}

        {/* 이전 멘트 (희미) */}
        {prevMent ? (
          <div className="opacity-35 transition-all duration-300">
            <p className="text-xs text-gray-600 mb-0.5 truncate">
              {formatSectionLabel(prevMent.section_label)}
            </p>
            <p className="text-gray-400 text-base leading-relaxed line-clamp-1">
              {prevMent.ment_text || "(멘트 없음)"}
            </p>
          </div>
        ) : <div className="h-10" />}

        {/* 현재 멘트 (메인) */}
        <div className="bg-gray-800/60 border border-primary-500/40 rounded-2xl px-8 py-7 shadow-2xl shadow-primary-900/20 transition-all duration-300">
          {sectionParts ? (
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded font-mono">
                {sectionParts.from}
              </span>
              <span className="text-gray-500 text-xs">→</span>
              <span className="px-2 py-0.5 bg-primary-900/60 text-primary-300 text-xs rounded font-mono">
                {sectionParts.to}
              </span>
            </div>
          ) : (
            <p className="text-primary-400 text-xs font-semibold mb-4 uppercase tracking-widest">
              {formatSectionLabel(currentMent?.section_label ?? "")}
            </p>
          )}

          {currentMent?.ment_text ? (
            <p className="text-white text-3xl font-medium leading-snug">
              {currentMent.ment_text}
            </p>
          ) : (
            <p className="text-gray-600 text-2xl italic">(멘트 없음)</p>
          )}
        </div>

        {/* 다음 멘트 미리보기 */}
        {nextMent ? (
          <div className="opacity-35 transition-all duration-300">
            <p className="text-xs text-gray-600 mb-0.5 truncate">
              다음 · {formatSectionLabel(nextMent.section_label)}
            </p>
            <p className="text-gray-400 text-base leading-relaxed line-clamp-1">
              {nextMent.ment_text || "(멘트 없음)"}
            </p>
          </div>
        ) : <div className="h-10" />}

        {/* 다다음 멘트 (매우 희미) */}
        {nextNextMent ? (
          <div className="opacity-15 transition-all duration-300">
            <p className="text-xs text-gray-700 mb-0.5 truncate">
              {formatSectionLabel(nextNextMent.section_label)}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed line-clamp-1">
              {nextNextMent.ment_text || "(멘트 없음)"}
            </p>
          </div>
        ) : <div className="h-8" />}
      </div>

      {/* ── 하단 네비게이션 ── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/60">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm font-medium"
        >
          ← 이전
        </button>

        {/* 전체 진행 도트 */}
        <div className="flex gap-1 max-w-xs overflow-hidden">
          {ments.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`transition-all duration-200 rounded-full ${
                i === current
                  ? "w-4 h-2 bg-primary-400"
                  : i < current
                  ? "w-2 h-2 bg-gray-600"
                  : "w-2 h-2 bg-gray-800"
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={isLast}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm font-medium"
        >
          다음 →
        </button>
      </div>

      <p className="text-center text-xs text-gray-800 pb-2">
        ← → 방향키 · 스페이스바
      </p>
    </div>
  );
}
