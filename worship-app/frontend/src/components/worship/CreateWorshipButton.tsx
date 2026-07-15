"use client";

import { useState } from "react";
import { useCreateWorship } from "@/hooks/useWorship";

const EMPTY_FORM = { title: "", scripture: "", sermon_direction: "", duration_minutes: 30 };

export function CreateWorshipButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { mutate, isPending } = useCreateWorship();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    mutate(
      { ...form, duration_minutes: Number(form.duration_minutes) },
      {
        onSuccess: () => { setOpen(false); setForm(EMPTY_FORM); setErrorMsg(null); },
        onError: (err: any) => {
          const msg = err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message ?? "알 수 없는 오류";
          setErrorMsg(typeof msg === "string" ? msg : JSON.stringify(msg));
        },
      }
    );
  };

  const directionLen = form.sermon_direction.length;

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
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">새 예배 만들기</h2>
            {errorMsg && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="예배 제목"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                required
                placeholder="말씀 본문 (예: 고린도전서 13:4-7)"
                value={form.scripture}
                onChange={(e) => setForm((f) => ({ ...f, scripture: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              {/* 설교 방향성 textarea */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">
                  설교 방향성 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  placeholder="목사님께 받은 설교 방향성을 입력하세요&#10;(예: 하나님의 사랑을 통해 우리가 서로를 용납해야 함을 강조, 회개와 회복의 흐름으로 진행...)"
                  value={form.sermon_direction}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setForm((f) => ({ ...f, sermon_direction: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none leading-relaxed"
                />
                <p className="text-right text-xs text-gray-300">{directionLen} / 500</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  required
                  type="number"
                  min={10}
                  max={180}
                  placeholder="예배 총 시간"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">분</span>
              </div>
              <p className="text-xs text-gray-400">
                예배 시간을 입력하면 AI가 시간에 맞는 찬양 목록을 자동으로 구성합니다
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50"
                >
                  {isPending ? "생성 중..." : "만들기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
