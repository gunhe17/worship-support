"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function CreateWorshipButton() {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient
        .post("/api/v1/worship/from-text", {
          raw_text: rawText,
          duration_minutes: durationMinutes,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worship"] });
      setOpen(false);
      setRawText("");
      setDurationMinutes(30);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        "알 수 없는 오류";
      setErrorMsg(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    setErrorMsg(null);
    mutate();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm"
      >
        + 새 예배
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-1">새 예배 만들기</h2>
            <p className="text-xs text-gray-400 mb-4">
              목사님께 받은 내용을 그대로 붙여넣으면 AI가 알아서 정리해드립니다
            </p>

            {errorMsg && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  말씀 / 주제 / 설교 방향성
                </label>
                <textarea
                  required
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`예시:\n\n본문: 요한복음 15:1-8\n주제: 포도나무와 가지\n방향성: 예수님 안에 거하는 삶의 중요성과 열매 맺음에 대해\n\n— 형식에 구애받지 않고 자유롭게 붙여넣어 주세요`}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
                  찬양 총 시간
                </label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <span className="text-sm text-gray-400">분</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setErrorMsg(null); }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending || !rawText.trim()}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      AI 분석 중...
                    </span>
                  ) : (
                    "예배 만들기"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
