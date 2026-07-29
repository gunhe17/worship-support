import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Song, SongSection } from "@/types";

const KEY = ["songs"];

export function useSongList(skip = 0, limit = 50) {
  return useQuery<Song[]>({
    queryKey: [...KEY, skip, limit],
    queryFn: () =>
      apiClient.get("/api/v1/songs", { params: { skip, limit } }).then((r) => r.data),
  });
}

export function useSongSearch(q: string) {
  return useQuery<Song[]>({
    queryKey: [...KEY, "search", q],
    queryFn: () =>
      apiClient.get("/api/v1/songs/search", { params: { q } }).then((r) => r.data),
    enabled: q.trim().length > 0,
  });
}

export function useSongDetail(id: string) {
  return useQuery<Song>({
    queryKey: [...KEY, id],
    queryFn: () => apiClient.get(`/api/v1/songs/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Song, "id" | "sections">) =>
      apiClient.post("/api/v1/songs", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Song> & { id: string }) =>
      apiClient.put(`/api/v1/songs/${id}`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/songs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── 구간(Section) hooks ───────────────────────────────────────────────────────

export function useSongSections(songId: string) {
  return useQuery<SongSection[]>({
    queryKey: [...KEY, songId, "sections"],
    queryFn: () =>
      apiClient.get(`/api/v1/songs/${songId}/sections`).then((r) => r.data),
    enabled: !!songId,
  });
}

export function useAddSection(songId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SongSection, "id" | "song_id">) =>
      apiClient.post(`/api/v1/songs/${songId}/sections`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, songId, "sections"] });
      qc.invalidateQueries({ queryKey: [...KEY, songId] });
    },
  });
}

export function useUpdateSection(songId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SongSection> & { id: string }) =>
      apiClient.put(`/api/v1/songs/${songId}/sections/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, songId, "sections"] });
      qc.invalidateQueries({ queryKey: [...KEY, songId] });
    },
  });
}

export function useDeleteSection(songId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sectionId: string) =>
      apiClient.delete(`/api/v1/songs/${songId}/sections/${sectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, songId, "sections"] });
      qc.invalidateQueries({ queryKey: [...KEY, songId] });
    },
  });
}

export function useReorderSections(songId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (section_ids: string[]) =>
      apiClient
        .put(`/api/v1/songs/${songId}/sections/reorder`, { section_ids })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, songId, "sections"] });
      qc.invalidateQueries({ queryKey: [...KEY, songId] });
    },
  });
}
