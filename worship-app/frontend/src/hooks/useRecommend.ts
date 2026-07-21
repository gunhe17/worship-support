import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// 예배 상세 진입 시 자동 실행 — DB에 캐시된 결과가 있으면 AI 재호출 없이 즉시 반환
export function useFullRecommend(req: FullRecommendReq | null) {
  return useQuery<FullRecommendResponse>({
    queryKey: ["full-recommend", req?.worship_id],
    queryFn: () =>
      apiClient
        .post("/api/v1/recommend/worship", { ...req, worship_type: "청년예배", count: 5 })
        .then((r) => r.data),
    enabled: !!req && !!req.worship_id && !!req.scripture,
    staleTime: Infinity, // DB가 영구 캐시이므로 프론트 캐시도 만료 없음
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

// "다른 찬양으로 다시 추천받기" — force_refresh=true로 AI 재분석 후 캐시 갱신
export function useForceRecommend(worshipId: string) {
  const queryClient = useQueryClient();
  return useMutation<FullRecommendResponse, Error, FullRecommendReq>({
    mutationFn: (req) =>
      apiClient
        .post("/api/v1/recommend/worship", {
          ...req,
          worship_type: "청년예배",
          count: 5,
          force_refresh: true,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["full-recommend", worshipId], data);
    },
  });
}
