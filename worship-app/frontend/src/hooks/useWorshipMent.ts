import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  SectionMentRecommendRequest,
  SectionMentRecommendResponse,
  WorshipMentItem,
  WorshipMentListResponse,
} from "@/types";

const QUERY_KEY = ["worship-ments"];

export function useWorshipMents(worshipId: string) {
  return useQuery<WorshipMentListResponse>({
    queryKey: [...QUERY_KEY, worshipId],
    queryFn: () => apiClient.get(`/api/v1/ments/${worshipId}`).then((r) => r.data),
    enabled: !!worshipId,
  });
}

export function useBatchSaveMents(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ments: WorshipMentItem[]) =>
      apiClient
        .post("/api/v1/ments/batch", { worship_id: worshipId, ments })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId] }),
  });
}

export function useRecommendSectionMent() {
  return useMutation<SectionMentRecommendResponse, Error, SectionMentRecommendRequest>({
    mutationFn: (req) =>
      apiClient.post("/api/v1/recommend/section-ment", req).then((r) => r.data),
  });
}
