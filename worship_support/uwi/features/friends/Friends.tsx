"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import AddFriendSheet from "@/features/friends/AddFriendSheet";
import TopBar from "@/features/shell/TopBar";
import { api, type Friends as FriendsData, type Friendship } from "@/lib/api";
import { emit, on } from "@/lib/events";
import { say } from "@/lib/messages";
import { duplicated } from "@/lib/names";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import ListRow, { Name } from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import { Empty, Failed } from "@/ui/State";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

export default function Friends() {
  const params = useSearchParams();
  const { data, error, loading, reload } = useLoad<FriendsData>(() => api.friends());
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Friendship | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("link") === "1" || params.get("add") === "1") setAdding(true);
  }, [params]);

  useEffect(() => on("friends", reload), [reload]);

  const changed = () => {
    emit("friends");
    emit("notifications");
    void reload();
  };

  const respond = async (row: Friendship, action: "accept" | "end") => {
    setBusy(row.pair_id);
    try {
      await api.respondFriend(row.pair_id, action);
      toast(action === "accept" ? `${row.person?.name ?? ""}님과 친구가 되었어요` : "친구 요청을 삭제했어요");
      changed();
    } catch (failure) {
      toast(say(failure));
      void reload();
    } finally {
      setBusy(null);
    }
  };

  const everyone = [...(data?.friends ?? []), ...(data?.received ?? []), ...(data?.sent ?? [])].map((row) => row.person);
  const dup = duplicated(everyone);
  const shared = (row: Friendship) => {
    const spaces = row.shared_spaces ?? [];
    if (spaces.length === 0) return "함께 있는 공간 없음";
    return spaces.length > 1 ? `${spaces[0].name} 외 ${spaces.length - 1}곳` : spaces[0].name;
  };

  return (
    <main className="pb-10">
      <TopBar
        title="친구"
        extra={
          <button type="button" aria-label="친구 추가" onClick={() => setAdding(true)} className="press inline-flex size-11 items-center justify-center">
            <Icon name="plus" size={26} />
          </button>
        }
      />
      <div className="px-gutter">
        {loading && !data ? <RowSkeleton rows={5} /> : null}
        {error && !data ? <Failed message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="enter-fade">
            {data.received.length ? (
              <>
                <SectionHead title="받은 요청" count={data.received.length} className="mt-6 mb-1" />
                {data.received.map((row) => (
                  <ListRow
                    key={row.pair_id}
                    leading={<Avatar id={row.user_id} />}
                    title={<Name name={row.person?.name ?? ""} email={row.person?.email} duplicate={dup.has(row.person?.name ?? "")} />}
                    trailing={
                      <span className="flex gap-2">
                        <Button tone="fill" size="row" busy={busy === row.pair_id} onClick={() => respond(row, "accept")}>
                          수락
                        </Button>
                        <Button tone="line" size="row" disabled={busy === row.pair_id} onClick={() => respond(row, "end")}>
                          삭제
                        </Button>
                      </span>
                    }
                  />
                ))}
              </>
            ) : null}

            <SectionHead title="친구" count={data.friends.length} className="mt-8 mb-1" />
            {data.friends.length === 0 ? <Empty text="아직 친구가 없어요" /> : null}
            {data.friends.map((row) => (
              <ListRow
                key={row.pair_id}
                leading={<Avatar id={row.user_id} />}
                title={<Name name={row.person?.name ?? ""} email={row.person?.email} duplicate={dup.has(row.person?.name ?? "")} />}
                subtitle={shared(row)}
                trailing={
                  <button type="button" aria-label={`${row.person?.name ?? ""} 더 보기`} onClick={() => setTarget(row)} className="press -mr-2 inline-flex size-11 items-center justify-center text-faint">
                    <Icon name="more" />
                  </button>
                }
              />
            ))}

            {data.sent.length ? (
              <>
                <SectionHead title="보낸 요청" count={data.sent.length} className="mt-8 mb-1" />
                {data.sent.map((row) => (
                  <ListRow
                    key={row.pair_id}
                    leading={<Avatar id={row.user_id} />}
                    title={<Name name={row.person?.name ?? ""} email={row.person?.email} duplicate={dup.has(row.person?.name ?? "")} />}
                    subtitle="수락을 기다리는 중"
                    trailing={
                      <button type="button" disabled={busy === row.pair_id} onClick={() => respond(row, "end")} className="press min-h-11 px-1 text-body text-sub">
                        취소
                      </button>
                    }
                  />
                ))}
              </>
            ) : null}

            {data.blocked.length ? (
              <>
                <button type="button" onClick={() => setBlockedOpen((open) => !open)} aria-expanded={blockedOpen} className="press mt-8 flex min-h-11 w-full items-center justify-between">
                  <SectionHead title="차단한 사람" count={data.blocked.length} />
                  <Icon name="chevronDown" size={22} className={blockedOpen ? "rotate-180 text-faint transition-transform" : "text-faint transition-transform"} />
                </button>
                {blockedOpen
                  ? data.blocked.map((row) => (
                      <ListRow
                        key={row.id}
                        leading={<Avatar id={row.user_id} />}
                        title={<span className="truncate">{row.person?.name ?? ""}</span>}
                        trailing={
                          <Button
                            tone="line"
                            size="row"
                            onClick={() =>
                              setConfirm({
                                title: `${row.person?.name ?? ""}님 차단을 풀까요?`,
                                detail: "친구 관계는 되살아나지 않아요",
                                action: "차단 풀기",
                                run: async () => {
                                  await api.block(row.user_id, "unblock");
                                  toast("차단을 풀었어요");
                                  changed();
                                },
                              })
                            }
                          >
                            차단 풀기
                          </Button>
                        }
                      />
                    ))
                  : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <FriendSheet
        friend={target}
        onClose={() => setTarget(null)}
        onEnd={(row) =>
          setConfirm({
            title: `${row.person?.name ?? ""}님과 친구를 끊을까요?`,
            detail: "상대에게 알리지 않아요. 다시 친구가 되려면 새로 요청해야 해요",
            action: "친구 끊기",
            danger: true,
            run: async () => {
              await api.respondFriend(row.pair_id, "end");
              toast("친구를 끊었어요");
              changed();
            },
          })
        }
        onBlock={(row) =>
          setConfirm({
            title: `${row.person?.name ?? ""}님을 차단할까요?`,
            detail: "친구가 끊기고, 서로 친구 요청과 공간 초대를 보낼 수 없어요. 상대에게 알리지 않아요",
            action: "차단",
            danger: true,
            run: async () => {
              await api.block(row.user_id, "block");
              toast("차단했어요");
              changed();
            },
          })
        }
      />
      <AddFriendSheet open={adding} onClose={() => setAdding(false)} onChanged={reload} />
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function FriendSheet({
  friend,
  onClose,
  onEnd,
  onBlock,
}: {
  friend: Friendship | null;
  onClose: () => void;
  onEnd: (row: Friendship) => void;
  onBlock: (row: Friendship) => void;
}) {
  const [last, setLast] = useState<Friendship | null>(friend);
  useEffect(() => {
    if (friend) setLast(friend);
  }, [friend]);
  const shown = friend ?? last;
  return (
    <Sheet open={friend !== null} onClose={onClose} title={shown?.person?.name ?? ""} description={shown?.person?.email ?? undefined}>
      <SectionHead title="함께 있는 공간" className="mt-4 mb-1" />
      {(shown?.shared_spaces ?? []).length === 0 ? <p className="py-3 text-body text-sub">함께 있는 공간이 없어요</p> : null}
      {(shown?.shared_spaces ?? []).map((space) => (
        <ListRow key={space.id} href={`/space?id=${space.id}`} title={<span className="font-normal">{space.name}</span>} />
      ))}
      <div className="mt-8 flex gap-6 pb-2">
        <Button
          tone="quiet"
          onClick={() => {
            onClose();
            if (shown) onEnd(shown);
          }}
        >
          친구 끊기
        </Button>
        <Button
          tone="quiet"
          onClick={() => {
            onClose();
            if (shown) onBlock(shown);
          }}
        >
          차단하기
        </Button>
      </div>
    </Sheet>
  );
}
