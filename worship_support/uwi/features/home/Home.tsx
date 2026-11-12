"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import CodeSheet from "@/features/join/CodeSheet";
import TopBar from "@/features/shell/TopBar";
import { api, type Friends, type Me, type Notices, type ReceivedInvite, type Space } from "@/lib/api";
import { emit, on } from "@/lib/events";
import AdminBadge from "@/ui/AdminBadge";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import ListRow from "@/ui/ListRow";
import Notice from "@/ui/Notice";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Skeleton, { RowSkeleton } from "@/ui/Skeleton";
import SpaceIcon from "@/ui/SpaceIcon";
import { Failed } from "@/ui/State";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

type HomeData = {
  me: Me;
  spaces: Space[];
  invites: ReceivedInvite[];
  friends: Friends;
  notices: Notices;
};

const DISMISS_KEY = "worship:notice-dismissed";

export default function Home() {
  const router = useRouter();
  const params = useSearchParams();
  const created = params.get("created");
  const [codeOpen, setCodeOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const { data, error, loading, reload } = useLoad<HomeData>(async () => {
    const [me, workspaces, friends, notices] = await Promise.all([api.me(), api.workspaces(), api.friends(), api.notifications()]);
    return { me, spaces: workspaces.spaces, invites: workspaces.received_invites, friends, notices };
  });

  useEffect(() => {
    if (params.get("code") === "1") setCodeOpen(true);
  }, [params]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(DISMISS_KEY);
    setDismissed(stored ? Number(stored) : null);
    const offs = [on("workspaces", reload), on("friends", reload), on("notifications", reload)];
    return () => offs.forEach((off) => off());
  }, [reload]);

  if (error && !data) {
    return (
      <main>
        <TopBar logo />
        <div className="px-gutter">
          <Failed message={error} onRetry={reload} />
        </div>
      </main>
    );
  }

  const join = (invite: ReceivedInvite) =>
    setConfirm({
      title: `‘${invite.workspace.name}’에 참여할까요?`,
      detail: `관리자 ${invite.workspace.manager?.name ?? ""}님 · 구성원 ${invite.workspace.member_count}명`,
      action: "참여하기",
      run: async () => {
        const joined = await api.answerInvite(invite.id, "accept");
        emit("workspaces");
        emit("notifications");
        router.push(`/space?id=${joined.workspace.id}`);
        toast(`‘${joined.workspace.name}’에 참여했어요`);
      },
    });

  const managed = data?.spaces.find((space) => space.role === "MANAGER" && space.waiting_invites > 0);
  const responses = data?.notices.needs_response_friend ?? 0;
  const showNotice = responses > 0 && dismissed !== responses;
  const spaceCount = data ? data.spaces.length : 0;

  return (
    <main className="min-h-dvh bg-band">
      <section className="rounded-b-sheet bg-page pb-8">
        <TopBar logo />
        <div className="px-gutter">
          {loading && !data ? (
            <Skeleton className="mt-6 h-7 w-48" />
          ) : (
            <h1 className="mt-6 text-greeting font-extrabold">{data?.me.name}님, 반가워요</h1>
          )}
          {data && spaceCount === 0 ? (
            <p className="mt-3 text-detail text-sub">
              {data.invites.length > 0
                ? "받은 초대는 아래에 남아 있어요. 둘러보다가 언제든 참여할 수 있어요."
                : "새 공간을 만들거나, 초대 메일의 코드로 참여할 수 있어요."}
            </p>
          ) : null}

          {managed ? (
            <div className="enter-fade mt-6 flex items-center gap-4 rounded-surface bg-surface p-5">
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-page text-title font-bold">
                {Array.from(managed.name)[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-head text-sub">{managed.name}</p>
                <p className="text-group font-bold">초대 {managed.waiting_invites}건이 답을 기다려요</p>
              </div>
              <Button tone="fill" onClick={() => router.push(`/space/manage?id=${managed.id}`)}>
                확인
              </Button>
            </div>
          ) : null}

          {showNotice ? (
            <div className="mt-3">
              <Notice
                icon="bell"
                count={responses}
                title={`응답할 알림 ${responses}개`}
                action="알림에서 답하기"
                onAction={() => router.push("/notifications")}
                onClose={() => {
                  window.sessionStorage.setItem(DISMISS_KEY, String(responses));
                  setDismissed(responses);
                }}
              />
            </div>
          ) : null}

          <SectionHead title="내 공간" count={spaceCount} large className="mt-8 mb-1" />
          {loading && !data ? <RowSkeleton rows={3} square /> : null}
          {data ? (
            <div className="enter-fade">
              {data.invites.map((invite) => (
                <ListRow
                  key={invite.id}
                  leading={<SpaceIcon name={invite.workspace.name} pending />}
                  title={<span className="truncate">{invite.workspace.name}</span>}
                  subtitle={`${invite.workspace.manager?.name ?? ""}님이 초대했어요`}
                  trailing={
                    <Button tone="fill" size="row" onClick={() => join(invite)}>
                      참여하기
                    </Button>
                  }
                />
              ))}
              {data.spaces.map((space) => (
                <ListRow
                  key={space.id}
                  className={space.id === created ? "enter-pop -mx-3 rounded-surface bg-tint px-3" : undefined}
                  href={`/space?id=${space.id}`}
                  leading={<SpaceIcon name={space.name} />}
                  title={
                    <>
                      <span className="truncate">{space.name}</span>
                      {space.role === "MANAGER" ? <AdminBadge /> : null}
                    </>
                  }
                  subtitle={
                    space.role === "MANAGER"
                      ? `내가 관리 · 구성원 ${space.member_count}명`
                      : `관리자 ${space.manager?.name ?? ""} · 구성원 ${space.member_count}명`
                  }
                />
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-4">
            <Button tone="line" onClick={() => router.push("/new-space")}>
              <Icon name="plus" size={20} />새 공간
            </Button>
            <Button tone="quiet" onClick={() => setCodeOpen(true)}>
              초대 코드로 참여
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-sheet bg-page px-gutter pt-8 pb-6">
        <h2 className="text-home-title font-extrabold">친구</h2>
        <div className="mt-4">
          {loading && !data ? <RowSkeleton rows={2} /> : null}
          {data ? (
            <div className="enter-fade">
              <ListRow
                href="/friends"
                leading={<RoundIcon name="people" />}
                title="내 친구"
                subtitle={data.friends.friends.length ? `${data.friends.friends.length}명` : "아직 없어요"}
              />
              {data.friends.received.length ? (
                <ListRow
                  href="/friends"
                  leading={<RoundIcon name="person" />}
                  title="받은 친구 요청"
                  subtitle={`${data.friends.received.length}명이 기다려요`}
                  trailing={<CountBadge count={data.friends.received.length} />}
                />
              ) : null}
              <ListRow href="/friends?link=1" leading={<RoundIcon name="link" />} title="친구 링크" subtitle="링크를 보내 친구 추가" />
            </div>
          ) : null}
        </div>
      </section>
      <div className="h-6" />

      <CodeSheet open={codeOpen} onClose={() => setCodeOpen(false)} initial={params.get("value")} />
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function RoundIcon({ name }: { name: string }) {
  return (
    <span className="inline-flex size-icon shrink-0 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name={name} size={24} />
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-badge font-bold text-white">{count}</span>
  );
}
