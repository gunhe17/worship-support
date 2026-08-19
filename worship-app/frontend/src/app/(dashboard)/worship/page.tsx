"use client";

import { useWorshipList } from "@/hooks/useWorship";
import { WorshipCard } from "@/components/worship/WorshipCard";
import { CreateWorshipButton } from "@/components/worship/CreateWorshipButton";

export default function WorshipPage() {
  const { data: worships, isLoading, isError, refetch } = useWorshipList();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">예배 목록을 불러오는 중...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-400">서버에 연결할 수 없습니다.</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-primary-500 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">예배 목록</h1>
        <CreateWorshipButton />
      </div>

      {!worships?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p>아직 예배가 없습니다.</p>
          <p className="text-sm mt-1">새 예배를 만들어 시작해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worships.map((w) => (
            <WorshipCard key={w.id} worship={w} />
          ))}
        </div>
      )}
    </div>
  );
}
