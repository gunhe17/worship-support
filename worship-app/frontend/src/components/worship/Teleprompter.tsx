"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorshipMentItem } from "@/types";

interface TeleprompterProps {
  ments: WorshipMentItem[];
  onExit: () => void;
}

const WINDOW_SIZE = 5;
const CURRENT_IDX = 2; // 5개 중 3번째(0-based: 2)가 현재

export function Teleprompter({ ments, onExit }: TeleprompterProps) {
  const [current, setCurrent] = useState(0);

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

  // 5개 슬롯 구성: current-2 ~ current+2
  const slots = Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const mentIdx = current - CURRENT_IDX + i;
    return mentIdx >= 0 && mentIdx < ments.length ? ments[mentIdx] : null;
  });

  const slotStyles = [
    "opacity-20 scale-90",      // -2: 매우 희미
    "opacity-40 scale-95",      // -1: 희미
    "opacity-100 scale-100",    // 0: 현재 (강조)
    "opacity-40 scale-95",      // +1: 희미
    "opacity-20 scale-90",      // +2: 매우 희미
  ];

  const isFirst = current === 0;
  const isLast = current === ments.length - 1;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-sm font-medium">인도 중</span>
        </div>
        <div className="text-gray-500 text-sm">
          {current + 1} / {ments.length}
        </div>
        <button
          onClick={onExit}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          종료 (ESC)
        </button>
      </div>

      {/* 멘트 표시 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
        {slots.map((ment, i) => {
          const isCurrent = i === CURRENT_IDX;
          return (
            <div
              key={i}
              className={`w-full max-w-3xl transition-all duration-300 ${slotStyles[i]}`}
            >
              {ment ? (
                <div
                  className={`rounded-2xl px-8 py-5 ${
                    isCurrent
                      ? "bg-gray-800 border border-primary-500 shadow-lg shadow-primary-900/30"
                      : "bg-transparent"
                  }`}
                >
                  {/* 섹션 라벨 */}
                  <p
                    className={`text-xs font-semibold mb-2 ${
                      isCurrent ? "text-primary-400" : "text-gray-600"
                    }`}
                  >
                    {ment.song_title}  ·  {ment.section_label}
                  </p>

                  {/* 멘트 텍스트 */}
                  {ment.ment_text ? (
                    <p
                      className={`leading-relaxed ${
                        isCurrent
                          ? "text-2xl font-medium text-white"
                          : "text-base text-gray-500"
                      }`}
                    >
                      {ment.ment_text}
                    </p>
                  ) : (
                    <p
                      className={`italic ${
                        isCurrent ? "text-xl text-gray-500" : "text-sm text-gray-700"
                      }`}
                    >
                      (멘트 없음)
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-16" />
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-5 border-t border-gray-800">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          ← 이전
        </button>

        <div className="flex gap-1">
          {ments.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-primary-400" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={isLast}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          다음 →
        </button>
      </div>

      {/* 키보드 힌트 */}
      <div className="text-center pb-3">
        <span className="text-xs text-gray-700">← → 방향키 또는 스페이스바로 이동</span>
      </div>
    </div>
  );
}
