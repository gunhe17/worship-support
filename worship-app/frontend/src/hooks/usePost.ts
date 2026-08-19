import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Comment, Post, PostSong, PostSummary } from "@/types";

const KEY = ["posts"];

export function usePostList(skip = 0, limit = 20, order_by = "latest") {
  return useQuery<PostSummary[]>({
    queryKey: [...KEY, skip, limit, order_by],
    queryFn: () =>
      apiClient.get("/api/v1/posts", { params: { skip, limit, order_by } }).then((r) => r.data),
  });
}

export function usePostDetail(id: string) {
  return useQuery<Post>({
    queryKey: [...KEY, id],
    queryFn: () => apiClient.get(`/api/v1/posts/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { author_name: string; scripture: string; meditation: string }) =>
      apiClient.post("/api/v1/posts", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { author_name: string; content: string }) =>
      apiClient.post(`/api/v1/posts/${postId}/comments`, data).then((r) => r.data as Comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, postId] }),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiClient.delete(`/api/v1/posts/${postId}/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, postId] }),
  });
}

export function useAddPostSong(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { song_id: string; order: number; ment?: string }) =>
      apiClient.post(`/api/v1/posts/${postId}/songs`, data).then((r) => r.data as PostSong),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, postId] }),
  });
}

export function useRemovePostSong(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postSongId: string) =>
      apiClient.delete(`/api/v1/posts/${postId}/songs/${postSongId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, postId] }),
  });
}
