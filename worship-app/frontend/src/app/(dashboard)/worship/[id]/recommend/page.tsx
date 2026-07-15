"use client";

import { useParams, redirect } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 이 페이지는 더 이상 사용하지 않습니다.
// 분석 기능이 /worship/[id] 페이지에 통합되었습니다.
export default function RecommendRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/worship/${id}`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">이동 중...</p>
    </div>
  );
}
