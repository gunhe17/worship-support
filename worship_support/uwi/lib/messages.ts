import { ApiError } from "@/lib/api";

const messages: Record<string, string> = {
  code_mismatch: "코드가 맞지 않아요. 초대 메일을 다시 확인해 주세요",
  invalid_format: "형식이 맞지 않아요. 다시 확인해 주세요",
  removed_member: "관리자에게 초대를 받아야 들어갈 수 있어요",
  link_unusable: "쓸 수 없는 링크예요. 관리자에게 새 링크를 받아 주세요",
  workspace_closed: "삭제된 공간이에요",
  already_member: "이미 참여한 공간이에요",
  invite_closed: "이미 답했거나 기한이 지난 초대예요",
  workspace_name_taken: "같은 이름의 공간에 이미 참여하고 있어요",
  workspace_name_mismatch: "공간 이름이 맞지 않아요",
  manager_must_transfer: "관리자는 먼저 관리자를 넘겨야 해요",
  not_friend: "친구에게만 초대를 보낼 수 있어요",
  blocked: "친구 요청을 보낼 수 없는 사람이에요",
  friend_exists: "이미 친구이거나 요청을 보냈어요",
  friend_request_closed: "이미 처리된 친구 요청이에요",
  friend_unreachable: "같은 공간에 있거나 친구 링크로 온 사람에게만 요청할 수 있어요",
  friend_self: "나에게는 친구 요청을 보낼 수 없어요",
  friend_quota: "친구 요청을 너무 많이 보냈어요. 내일 다시 보내 주세요",
  document_name_taken: "같은 이름의 문서가 있어요",
  group_name_taken: "같은 이름의 그룹이 있어요",
  unauthorized: "다시 로그인해 주세요",
  network: "연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요",
};

export function say(failure: unknown, fallback = "문제가 생겼어요. 다시 시도해 주세요"): string {
  if (failure instanceof ApiError) return (failure.key && messages[failure.key]) || failure.message || fallback;
  return fallback;
}
