"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import InviteSheet from "@/features/space/InviteSheet";
import SubHeader from "@/features/shell/SubHeader";
import { api, type InviteRow, type Invites, type Member, type SpaceDetail } from "@/lib/api";
import { copy } from "@/lib/clipboard";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import { duplicated } from "@/lib/names";
import { day } from "@/lib/time";
import AdminBadge from "@/ui/AdminBadge";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import ListRow, { Name } from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import { Failed } from "@/ui/State";
import Surface from "@/ui/Surface";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

type Data = { space: SpaceDetail; members: Member[]; invites: Invites | null };

const stateText: Record<InviteRow["state"], string> = {
  pending: "대기 중",
  accepted: "들어왔어요",
  declined: "거절했어요",
  expired: "취소했거나 기한이 지났어요",
};

export default function Manage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [inviting, setInviting] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [target, setTarget] = useState<Member | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const { data, error, loading, reload } = useLoad<Data>(async () => {
    const [space, members] = await Promise.all([api.workspace(id), api.members(id)]);
    const invites = space.role === "MANAGER" ? await api.invites(id) : null;
    return { space, members, invites };
  }, [id]);

  useEffect(() => {
    if (params.get("invite") === "1" && data?.space.role === "MANAGER") setInviting(true);
  }, [params, data?.space.role]);

  if (error && !data) {
    return (
      <main>
        <SubHeader title="공간" back="/space" />
        <div className="px-gutter">
          <Failed message={error} onRetry={reload} />
        </div>
      </main>
    );
  }

  const space = data?.space;
  const manager = space?.role === "MANAGER";
  const dup = duplicated((data?.members ?? []).map((member) => member.person));

  const copyLink = async () => {
    try {
      const link = await api.link(id);
      const copied = await copy(`${window.location.origin}/join?token=${link.token}`);
      toast(copied ? (link.created ? "링크를 복사했어요. 링크가 있는 사람은 누구나 들어올 수 있어요" : "링크를 복사했어요") : "복사하지 못했어요");
      reload();
    } catch (failure) {
      toast(say(failure));
    }
  };

  const replaceLink = (mode: "replace" | "disable") =>
    setConfirm({
      title: mode === "replace" ? "새 링크로 바꿀까요?" : "초대 링크를 끌까요?",
      detail: "지금 링크로는 더 이상 들어올 수 없어요",
      action: mode === "replace" ? "바꾸기" : "끄기",
      run: async () => {
        await api.replaceLink(id, mode);
        toast(mode === "replace" ? "새 링크로 바꿨어요. 다시 복사해 주세요" : "초대 링크를 껐어요");
        reload();
      },
    });

  const cancel = (row: InviteRow) =>
    setConfirm({
      title: "초대를 취소할까요?",
      detail: row.email ?? row.person?.name ?? "",
      action: "취소하기",
      run: async () => {
        await api.cancelInvite(id, row.kind, row.id);
        toast("초대를 취소했어요");
        reload();
      },
    });

  const resend = (row: InviteRow) =>
    setConfirm({
      title: "초대를 다시 보낼까요?",
      detail: `${row.email ?? row.person?.name ?? ""} · 전에 보낸 초대는 쓸 수 없게 돼요`,
      action: "다시 보내기",
      run: async () => {
        await api.resendInvite(id, row.kind, row.id);
        toast("초대를 다시 보냈어요");
        reload();
      },
    });

  const inviteRow = (row: InviteRow, past: boolean) => (
    <ListRow
      key={row.id}
      leading={<Avatar id={row.person?.id ?? row.email ?? row.id} />}
      title={<span className="truncate">{row.email ?? row.person?.name}</span>}
      subtitle={past ? stateText[row.state] : `대기 중 · ${day(row.expires_at)} 만료`}
      trailing={
        <span className="flex shrink-0 items-center gap-2">
          <Button tone="text" onClick={() => resend(row)}>
            {past ? "한 번 더 보내기" : "다시 보내기"}
          </Button>
          {past ? null : (
            <button type="button" onClick={() => cancel(row)} className="press min-h-11 px-1 text-body text-sub">
              취소
            </button>
          )}
        </span>
      }
    />
  );

  return (
    <main className="pb-10">
      <SubHeader
        title={manager ? "구성원 관리" : "구성원"}
        description={space ? `${space.name} · 구성원 ${space.member_count}명` : " "}
        back={`/space?id=${id}`}
      />
      <div className="px-gutter">
        {loading && !data ? <RowSkeleton rows={4} /> : null}

        {data && manager && data.invites ? (
          <div className="enter-fade">
            <SectionHead title="사람 초대" className="mt-8 mb-3" />
            <Surface className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-name font-semibold">친구나 이메일로 초대</p>
                  <p className="mt-0.5 text-detail text-sub">초대받은 사람이 수락하면 들어와요</p>
                </div>
                <Button tone="line" onClick={() => setInviting(true)}>
                  초대하기
                </Button>
              </div>
              <div>
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-name font-semibold">초대 링크</p>
                    <p className="mt-0.5 text-detail text-sub">링크를 받은 사람은 바로 참여해요</p>
                  </div>
                  <Button tone="line" onClick={copyLink}>
                    링크 복사
                  </Button>
                </div>
                {data.invites.link_enabled ? (
                  <div className="mt-2 flex gap-5">
                    <button type="button" onClick={() => replaceLink("replace")} className="press min-h-11 text-body font-medium text-sub">
                      새 링크로 바꾸기
                    </button>
                    <button type="button" onClick={() => replaceLink("disable")} className="press min-h-11 text-body font-medium text-sub">
                      링크 끄기
                    </button>
                  </div>
                ) : null}
              </div>
            </Surface>

            <SectionHead title="보낸 초대" count={data.invites.sent.length} className="mt-10 mb-1" />
            {data.invites.sent.length === 0 ? <p className="py-3 text-body text-sub">답을 기다리는 초대가 없어요</p> : null}
            {data.invites.sent.map((row) => inviteRow(row, false))}

            {data.invites.past.length ? (
              <>
                <button
                  type="button"
                  onClick={() => setPastOpen((open) => !open)}
                  aria-expanded={pastOpen}
                  className="press mt-8 flex min-h-11 w-full items-center justify-between"
                >
                  <SectionHead title="지난 초대" count={data.invites.past.length} />
                  <Icon name="chevronDown" size={22} className={pastOpen ? "rotate-180 text-faint transition-transform" : "text-faint transition-transform"} />
                </button>
                {pastOpen ? <div className="enter-fade">{data.invites.past.map((row) => inviteRow(row, true))}</div> : null}
              </>
            ) : null}
          </div>
        ) : null}

        {data ? (
          <div className="enter-fade">
            <SectionHead title="구성원" count={data.members.length} className="mt-10 mb-1" />
            {data.members.map((member) => (
              <ListRow
                key={member.id}
                leading={<Avatar id={member.user_id} />}
                title={
                  <>
                    <Name name={member.person?.name ?? ""} email={member.person?.email} duplicate={dup.has(member.person?.name ?? "")} />
                    {member.role === "MANAGER" ? <AdminBadge /> : null}
                  </>
                }
                subtitle={member.me ? "나" : undefined}
                trailing={
                  member.me ? null : (
                    <button type="button" aria-label={`${member.person?.name ?? ""} 더 보기`} onClick={() => setTarget(member)} className="press -mr-2 inline-flex size-11 items-center justify-center text-faint">
                      <Icon name="more" />
                    </button>
                  )
                }
              />
            ))}
            {manager ? (
              <div className="mt-6">
                <ListRow onClick={() => setHistoryOpen(true)} leading={<Icon name="clock" />} title={<span className="font-normal">초대·변경 이력</span>} trailing={<Icon name="chevronRight" size={22} className="text-faint" />} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="초대·변경 이력" description={space?.name}>
        {history(data).length === 0 ? <p className="py-4 text-body text-sub">아직 이력이 없어요</p> : null}
        {history(data).map((item, index) => (
          <ListRow key={index} leading={<Avatar id={item.key} />} title={<span className="truncate">{item.who}</span>} subtitle={`${item.what} · ${day(item.at)}`} />
        ))}
      </Sheet>

      {data && manager ? (
        <InviteSheet
          open={inviting}
          onClose={() => setInviting(false)}
          workspace={{ id, name: data.space.name }}
          members={data.members}
          sent={data.invites?.sent ?? []}
          onChanged={reload}
          onCopyLink={copyLink}
        />
      ) : null}

      <MemberSheet
        member={target}
        manager={Boolean(manager)}
        onClose={() => setTarget(null)}
        onFriend={(member) =>
          setConfirm({
            title: `${member.person?.name ?? ""}님에게 친구 요청을 보낼까요?`,
            detail: "수락하면 서로 친구가 돼요",
            action: "보내기",
            run: async () => {
              const result = await api.requestFriend(member.user_id);
              toast(result.result === "accepted" ? "이제 친구예요" : "친구 요청을 보냈어요");
              emit("friends");
              reload();
            },
          })
        }
        onRemove={(member) =>
          setConfirm({
            title: `${member.person?.name ?? ""}님을 내보낼까요?`,
            detail: "초대 링크로는 다시 들어올 수 없어요",
            action: "내보내기",
            danger: true,
            run: async () => {
              await api.removeMember(id, member.id);
              toast(`${member.person?.name ?? ""}님을 내보냈어요`);
              reload();
            },
          })
        }
      />
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function MemberSheet({
  member,
  manager,
  onClose,
  onFriend,
  onRemove,
}: {
  member: Member | null;
  manager: boolean;
  onClose: () => void;
  onFriend: (member: Member) => void;
  onRemove: (member: Member) => void;
}) {
  const [last, setLast] = useState<Member | null>(member);
  useEffect(() => {
    if (member) setLast(member);
  }, [member]);
  const shown = member ?? last;
  const relation: Record<string, string> = {
    friend: "친구예요",
    sent: "친구 요청을 보냈어요",
    received: "나에게 친구 요청을 보냈어요",
    blocked: "차단한 사람이에요",
  };
  return (
    <Sheet open={member !== null} onClose={onClose} title={shown?.person?.name ?? ""} description={shown?.person?.email ?? undefined}>
      <div className="pb-2">
        {shown && shown.relation === "none" ? (
          <ListRow
            onClick={() => {
              onClose();
              onFriend(shown);
            }}
            leading={<Icon name="userPlus" />}
            title={<span className="font-normal">친구 요청 보내기</span>}
          />
        ) : shown ? (
          <p className="py-3 text-body text-sub">{relation[shown.relation]}</p>
        ) : null}
        {shown && manager && shown.role !== "MANAGER" ? (
          <div className="mt-6">
            <Button
              tone="quiet"
              onClick={() => {
                onClose();
                onRemove(shown);
              }}
            >
              공간에서 내보내기
            </Button>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function history(data: Data | null) {
  if (!data) return [];
  const items: Array<{ key: string; who: string; what: string; at: string }> = [];
  for (const row of [...(data.invites?.sent ?? []), ...(data.invites?.past ?? [])]) {
    const who = row.email ?? row.person?.name ?? "";
    items.push({ key: row.person?.id ?? row.email ?? row.id, who, what: row.kind === "email" ? "이메일 초대 보냄" : "친구 초대 보냄", at: row.created_at });
    if (row.state !== "pending") items.push({ key: row.person?.id ?? row.email ?? row.id, who, what: stateText[row.state], at: row.expires_at });
  }
  for (const member of data.members) {
    if (member.joined_at) items.push({ key: member.user_id, who: member.person?.name ?? "", what: member.role === "MANAGER" ? "관리자" : "참여", at: member.joined_at });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
