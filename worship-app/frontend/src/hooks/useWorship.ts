import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Arrangement, Worship } from "@/types";

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

// ── Arrangement (콘티) hooks ──────────────────────────────────────────────────

export function useArrangements(worshipId: string) {
  return useQuery<Arrangement[]>({
    queryKey: [...QUERY_KEY, worshipId, "arrangements"],
    queryFn: () =>
      apiClient.get(`/api/v1/worship/${worshipId}/arrangements`).then((r) => r.data),
    enabled: !!worshipId,
  });
}

export function useAddArrangement(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { song_id: string; order: number; song_form: string[]; ment?: string }) =>
      apiClient.post(`/api/v1/worship/${worshipId}/arrangements`, data).then((r) => r.data as Arrangement),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId, "arrangements"] }),
  });
}

export function useUpdateArrangement(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; song_form?: string[]; ment?: string; order?: number }) =>
      apiClient.put(`/api/v1/worship/${worshipId}/arrangements/${id}`, data).then((r) => r.data as Arrangement),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId, "arrangements"] }),
  });
}

export function useDeleteArrangement(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arrId: string) =>
      apiClient.delete(`/api/v1/worship/${worshipId}/arrangements/${arrId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId, "arrangements"] }),
  });
}

export function useBulkAddArrangements(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { song_id: string; order: number; ment: string; song_form: string[] }[]) =>
      apiClient
        .post(`/api/v1/worship/${worshipId}/arrangements/bulk`, items)
        .then((r) => r.data as Arrangement[]),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId, "arrangements"] }),
  });
}

export function useUploadSheet(worshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arrId, file }: { arrId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient
        .post(`/api/v1/worship/${worshipId}/arrangements/${arrId}/sheet`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data as Arrangement);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, worshipId, "arrangements"] }),
  });
}
