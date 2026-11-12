export type Person = { id: string; name: string; email: string | null };

export type Space = {
  id: string;
  name: string;
  role: "MANAGER" | "MEMBER";
  member_count: number;
  manager: Person | null;
  waiting_invites: number;
};

export type ReceivedInvite = {
  id: string;
  expires_at: string;
  workspace: { id: string; name: string; member_count: number; manager: Person | null };
};

export type SpaceDetail = {
  id: string;
  name: string;
  role: "MANAGER" | "MEMBER";
  member_id: string;
  member_count: number;
  manager: Person | null;
};

export type Relation = "none" | "sent" | "received" | "friend" | "blocked";

export type Member = {
  id: string;
  user_id: string;
  role: "MANAGER" | "MEMBER";
  person: Person | null;
  me: boolean;
  relation: Relation;
};

export type InviteRow = {
  id: string;
  kind: "email" | "friend";
  email?: string;
  person?: Person | null;
  recipient_user_id?: string;
  expires_at: string;
  created_at: string;
  state: "pending" | "accepted" | "declined" | "expired";
};

export type Invites = { sent: InviteRow[]; past: InviteRow[]; link_enabled: boolean };

export type Friendship = {
  pair_id: string;
  user_id: string;
  state: Relation;
  person: Person | null;
  shared_spaces?: Array<{ id: string; name: string }>;
};

export type Friends = {
  friends: Friendship[];
  received: Friendship[];
  sent: Friendship[];
  blocked: Array<{ id: string; user_id: string; person: Person | null }>;
};

export type Notice = {
  id: string;
  kind: string;
  actor: Person | null;
  target_type: string | null;
  target_id: string | null;
  text: string;
  created_at: string;
  read: boolean;
  action_state: "pending" | "accepted" | "declined" | "expired" | "closed" | null;
};

export type Notices = { items: Notice[]; unread: number; needs_response: number; needs_response_friend: number };

export type Me = {
  id: string;
  name: string;
  email: string | null;
  social_accounts: Array<{ id: string; provider: string; email: string | null; linked_at: string | null }>;
};

export type Device = { id: string; device_label: string | null; last_used_at: string | null; current: boolean };

export type Preview = {
  id: string;
  name: string;
  manager: Person | null;
  member_count: number;
  already_member: boolean;
};

export type Doc = { id: string; name: string; visibility: "OPEN" | "RESTRICTED"; my_role: string | null; owner_name: string | null; updated_at: string; locked: boolean };

export type Group = { id: string; name: string; member_count: number };

export class ApiError extends Error {
  status: number;
  key: string | null;
  constructor(status: number, key: string | null, message: string) {
    super(message);
    this.status = status;
    this.key = key;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요");
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth")) {
      window.dispatchEvent(new Event("worship:auth"));
    }
    throw new ApiError(response.status, json.key ?? null, json.message ?? "문제가 생겼어요. 다시 시도해 주세요");
  }
  return json.data as T;
}

export const api = {
  developLogin: (email: string, name: string) => call<{ user: { id: string } }>("POST", "/auth/develop-login", { email, name }),
  logout: () => call<object>("POST", "/auth/logout"),
  me: () => call<Me>("GET", "/account/me"),
  rename: (name: string) => call<Me>("PATCH", "/account/me", { name }),
  devices: () => call<Device[]>("GET", "/account/sessions"),
  revokeDevice: (id: string) => call<object>("POST", "/account/sessions/revoke", { id }),
  withdraw: () => call<object>("POST", "/account/withdraw"),

  workspaces: () => call<{ spaces: Space[]; received_invites: ReceivedInvite[] }>("GET", "/workspaces"),
  createWorkspace: (name: string) => call<{ id: string; name: string }>("POST", "/workspaces", { name }),
  workspace: (id: string) => call<SpaceDetail>("GET", `/workspaces/${id}`),
  renameWorkspace: (id: string, name: string) => call<{ id: string; name: string }>("PATCH", `/workspaces/${id}`, { name }),
  closeWorkspace: (id: string, confirm_name: string) => call<object>("POST", `/workspaces/${id}/close`, { confirm_name }),
  transfer: (id: string, member_id: string) => call<object>("POST", `/workspaces/${id}/transfer`, { member_id }),
  leave: (id: string) => call<object>("POST", `/workspaces/${id}/leave`),
  members: (id: string) => call<Member[]>("GET", `/workspaces/${id}/members`),
  removeMember: (id: string, member_id: string) => call<object>("POST", `/workspaces/${id}/members/remove`, { member_id }),
  documents: (id: string) => call<Doc[]>("GET", `/workspaces/${id}/documents`),
  createDocument: (id: string, name: string) => call<{ id: string; name: string }>("POST", `/workspaces/${id}/documents`, { name }),
  groups: (id: string) => call<Group[]>("GET", `/workspaces/${id}/groups`),
  createGroup: (id: string, name: string) => call<Group>("POST", `/workspaces/${id}/groups`, { name }),

  invites: (id: string) => call<Invites>("GET", `/workspaces/${id}/invites`),
  inviteEmails: (id: string, emails: string[]) => call<object[]>("POST", `/workspaces/${id}/invites/email`, { emails }),
  inviteFriends: (id: string, user_ids: string[]) => call<object[]>("POST", `/workspaces/${id}/invites/friend`, { user_ids }),
  cancelInvite: (id: string, kind: string, inviteId: string) => call<object>("POST", `/workspaces/${id}/invites/cancel`, { kind, id: inviteId }),
  resendInvite: (id: string, kind: string, inviteId: string) => call<object>("POST", `/workspaces/${id}/invites/resend`, { kind, id: inviteId }),
  link: (id: string) => call<{ token: string; created: boolean }>("POST", `/workspaces/${id}/link`),
  replaceLink: (id: string, mode: "replace" | "disable") => call<{ token?: string }>("POST", `/workspaces/${id}/link/replace`, { mode }),

  checkCode: (code: string) => call<Preview>("POST", "/join/code/check", { code }),
  joinCode: (code: string) => call<{ workspace: { id: string; name: string }; already_member: boolean }>("POST", "/join/code", { code }),
  checkLink: (token: string) => call<Preview>("POST", "/join/link/check", { token }),
  joinLink: (token: string) => call<{ workspace: { id: string; name: string }; already_member: boolean }>("POST", "/join/link", { token }),
  answerInvite: (id: string, answer: "accept" | "decline") =>
    call<{ workspace: { id: string; name: string }; already_member: boolean }>("POST", "/join/invite", { id, answer }),

  friends: () => call<Friends>("GET", "/friends"),
  requestFriend: (user_id: string) => call<{ result: string }>("POST", "/friends/request", { user_id }),
  respondFriend: (pair_id: string, action: "accept" | "end") => call<object>("POST", "/friends/respond", { pair_id, action }),
  block: (user_id: string, action: "block" | "unblock") => call<object>("POST", "/friends/block", { user_id, action }),
  friendLink: (mode: "get" | "replace") => call<{ token: string }>("POST", "/friends/link", { mode }),
  friendByLink: (token: string, action: "check" | "request") =>
    call<{ owner: { id: string; name: string }; me?: boolean; relation?: Relation; result?: string }>("POST", "/friends/by-link", { token, action }),

  devMail: () => call<Array<{ to: string; subject: string; body: string; sent_at: string }>>("GET", "/develop/mail"),
  notifications: () => call<Notices>("GET", "/notifications"),
  readNotifications: () => call<object>("POST", "/notifications/read"),
};
