import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Worship } from "@/types";

const QUERY_KEY = ["worship"];

export function useWorshipList(skip = 0, limit = 20) {
  return useQuery<Worship[]>({
    queryKey: [...QUERY_KEY, skip, limit],
    queryFn: () =>
      apiClient.get("/api/v1/worship", { params: { skip, limit } }).then((r) => r.data),
  });
}

export function useWorshipDetail(id: string) {
  return useQuery<Worship>({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get(`/api/v1/worship/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateWorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Worship, "id" | "created_at">) =>
      apiClient.post("/api/v1/worship", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateWorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Worship> & { id: string }) =>
      apiClient.put(`/api/v1/worship/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteWorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/worship/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
