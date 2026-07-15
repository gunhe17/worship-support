import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { FullRecommendResponse, ScriptureAnalysis, SongRecommendation } from "@/types";

export function useAnalyzeScripture() {
  return useMutation<ScriptureAnalysis, Error, { scripture: string; worship_type?: string }>({
    mutationFn: (data) =>
      apiClient.post("/api/v1/recommend/scripture", data).then((r) => r.data),
  });
}

export function useRecommendSongs() {
  return useMutation<
    { recommendations: SongRecommendation[] },
    Error,
    { scripture: string; themes: string[]; worship_type?: string; count?: number }
  >({
    mutationFn: (data) =>
      apiClient.post("/api/v1/recommend/song", data).then((r) => r.data),
  });
}

export function useRecommendMent() {
  return useMutation<
    { ment: string; alternatives: string[] },
    Error,
    { worship_id: string; position: "intro" | "transition" | "outro" }
  >({
    mutationFn: (data) =>
      apiClient.post("/api/v1/recommend/ment", data).then((r) => r.data),
  });
}

interface FullRecommendReq {
  worship_id: string;
  scripture: string;
  sermon_direction?: string;
  duration_minutes: number;
  worship_type?: string;
  count?: number;
}

// 본문 분석 + 곡 추천 + YouTube 검색을 한 번에 자동 실행하는 훅
export function useFullRecommend(req: FullRecommendReq | null) {
  return useQuery<FullRecommendResponse>({
    queryKey: ["full-recommend", req?.worship_id],
    queryFn: () =>
      apiClient
        .post("/api/v1/recommend/worship", { ...req, worship_type: "청년예배", count: 5 })
        .then((r) => r.data),
    enabled: !!req && !!req.worship_id && !!req.scripture,
    staleTime: 15 * 60 * 1000, // 15분 캐시 (같은 예배 카드 재방문 시 재분석 안 함)
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
