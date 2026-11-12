"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import SubHeader from "@/features/shell/SubHeader";
import { api, type Notice, type Notices } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import { ago } from "@/lib/time";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import Popup, { type Confirm } from "@/ui/Popup";
import { RowSkeleton } from "@/ui/Skeleton";
import { Empty, Failed } from "@/ui/State";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

const category: Record<string, string> = {
  FRIEND_REQUEST: "친구 요청",
  FRIEND_ACCEPTED: "친구",
  WORKSPACE_INVITE: "공간 초대",
  WORKSPACE_INVITE_DECLINED: "공간 초대",
  MEMBER_JOINED: "공간 구성원",
  MEMBER_RETURNED: "공간 구성원",
  MEMBER_LEFT: "공간 구성원",
  MEMBER_REMOVED: "공간",
  MANAGER_TRANSFERRED: "공간 관리자",
  WORKSPACE_CLOSED: "공간",
};

const result: Record<string, Record<string, string>> = {
  FRIEND_REQUEST: { accepted: "수락했어요", closed: "처리된 요청이에요" },
  WORKSPACE_INVITE: { accepted: "참여했어요", declined: "거절했어요", expired: "기한이 지났거나 취소된 초대예요" },
};

export default function Notifications() {
  const router = useRouter();
  const { data, error, loading, reload, setData } = useLoad<Notices>(() => api.notifications());
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [restored, setRestored] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (!data || marked.current) return;
    marked.current = true;
    setUnread(new Set(data.items.filter((item) => !item.read).map((item) => item.id)));
    if (data.unread > 0) {
      api
        .readNotifications()
        .then(() => emit("notifications"))
        .catch(() => undefined);
    }
  }, [data]);

  const settle = (notice: Notice, state: Notice["action_state"]) =>
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === notice.id ? { ...item, action_state: state } : item)) } : current,
    );

  const act = async (notice: Notice, run: () => Promise<void>) => {
    setBusy(notice.id);
    try {
      await run();
    } catch (failure) {
      toast(say(failure));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const friend = (notice: Notice, action: "accept" | "end") =>
    act(notice, async () => {
      await api.respondFriend(notice.target_id!, action);
      settle(notice, action === "accept" ? "accepted" : "closed");
      emit("friends");
      toast(action === "accept" ? `${notice.actor?.name ?? ""}님과 친구가 되었어요` : "친구 요청을 삭제했어요");
    });

  const invite = (notice: Notice, answer: "accept" | "decline") => {
    const run = () =>
      act(notice, async () => {
        const answered = await api.answerInvite(notice.target_id!, answer);
        settle(notice, answer === "accept" ? "accepted" : "declined");
        emit("workspaces");
        if (answer === "accept") {
          router.push(`/space?id=${answered.workspace.id}`);
          toast(`‘${answered.workspace.name}’에 참여했어요`);
        } else {
          toast("초대를 거절했어요");
        }
      });
    setConfirm({
      title: answer === "accept" ? "이 공간에 참여할까요?" : "초대를 거절할까요?",
      detail: answer === "accept" ? notice.text : "초대한 관리자에게 거절했다고 알려요",
      action: answer === "accept" ? "참여하기" : "거절",
      run,
    });
  };

  return (
    <main className="pb-10">
      <SubHeader title="알림" />
      <div className="mt-6 px-gutter">
        {loading && !data ? <RowSkeleton rows={4} /> : null}
        {error && !data ? <Failed message={error} onRetry={reload} /> : null}
        {data && data.items.length === 0 ? <Empty text="새 알림이 없어요" /> : null}
        {data ? (
          <ul className="enter-fade space-y-6">
            {data.items.map((notice) => {
              const done = notice.action_state && notice.action_state !== "pending" ? result[notice.kind]?.[notice.action_state] : null;
              return (
                <li key={notice.id} className="flex gap-4">
                  {notice.actor ? (
                    <Avatar id={notice.actor.id} />
                  ) : (
                    <span className="inline-flex size-icon shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                      <Icon name={notice.kind.startsWith("WORKSPACE") || notice.kind.startsWith("MEMBER") ? "spaces" : "doc"} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-name">
                      <Emphasis text={notice.text} name={notice.actor?.name} />
                    </p>
                    <p className="mt-0.5 text-detail text-sub">
                      {category[notice.kind] ?? "알림"} · {ago(notice.created_at)}
                    </p>
                    {notice.action_state === "pending" && notice.kind === "FRIEND_REQUEST" ? (
                      <div className="mt-3 flex gap-2">
                        <Button tone="fill" size="row" busy={busy === notice.id} onClick={() => friend(notice, "accept")}>
                          수락
                        </Button>
                        <Button tone="line" size="row" disabled={busy === notice.id} onClick={() => friend(notice, "end")}>
                          삭제
                        </Button>
                      </div>
                    ) : null}
                    {notice.action_state === "pending" && notice.kind === "WORKSPACE_INVITE" ? (
                      <div className="mt-3 flex gap-2">
                        <Button tone="fill" size="row" busy={busy === notice.id} onClick={() => invite(notice, "accept")}>
                          참여하기
                        </Button>
                        <Button tone="line" size="row" disabled={busy === notice.id} onClick={() => invite(notice, "decline")}>
                          거절
                        </Button>
                      </div>
                    ) : null}
                    {notice.kind === "MEMBER_RETURNED" && !restored.has(notice.id) ? (
                      <div className="mt-3">
                        <Button
                          tone="line"
                          size="row"
                          busy={busy === notice.id}
                          onClick={() =>
                            act(notice, async () => {
                              const result = await api.restoreMember(notice.target_id!);
                              setRestored((current) => new Set(current).add(notice.id));
                              toast(`이전 권한을 되살렸어요 (그룹 ${result.groups}개 · 문서 ${result.grants}개)`);
                            })
                          }
                        >
                          이전 권한 되살리기
                        </Button>
                      </div>
                    ) : null}
                    {restored.has(notice.id) ? <p className="mt-2 text-detail text-sub">이전 권한을 되살렸어요</p> : null}
                    {done ? <p className="mt-2 text-detail text-sub">{done}</p> : null}
                  </div>
                  {unread.has(notice.id) ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="안 읽음" /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {data && data.items.length > 0 ? <p className="mt-12 text-center text-detail text-sub">알림은 90일 동안 보관돼요</p> : null}
      </div>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function Emphasis({ text, name }: { text: string; name?: string }) {
  if (!name || !text.startsWith(`${name}님`)) return <>{text}</>;
  return (
    <>
      <strong className="font-bold">{name}</strong>
      {text.slice(name.length)}
    </>
  );
}
