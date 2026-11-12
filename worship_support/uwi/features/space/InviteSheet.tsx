"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api, type Friends, type InviteRow, type Member } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import { duplicated } from "@/lib/names";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Check from "@/ui/Check";
import Icon from "@/ui/Icon";
import ListRow, { Name } from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import TextInput from "@/ui/TextInput";
import { toast } from "@/ui/Toaster";

export default function InviteSheet({
  open,
  onClose,
  workspace,
  members,
  sent,
  onChanged,
  onCopyLink,
}: {
  open: boolean;
  onClose: () => void;
  workspace: { id: string; name: string };
  members: Member[];
  sent: InviteRow[];
  onChanged: () => void;
  onCopyLink: () => void;
}) {
  const router = useRouter();
  const [friends, setFriends] = useState<Friends | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setQuery("");
    setEmail("");
    setEmailError(null);
    setFailed(null);
    api.friends().then(setFriends).catch((failure) => setFailed(say(failure)));
  }, [open]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members]);
  const pendingByUser = useMemo(
    () => new Map(sent.filter((row) => row.kind === "friend" && row.recipient_user_id).map((row) => [row.recipient_user_id as string, row])),
    [sent],
  );
  const candidates = (friends?.friends ?? []).filter((friend) => friend.person && !memberIds.has(friend.user_id));
  const dup = duplicated(candidates.map((friend) => friend.person));
  const shown = candidates.filter((friend) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return friend.person!.name.toLowerCase().includes(text) || (friend.person!.email ?? "").toLowerCase().includes(text);
  });

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inviteFriends = () => {
    const names = candidates.filter((friend) => picked.has(friend.user_id)).map((friend) => friend.person!.name);
    setConfirm({
      title: `${picked.size}명을 ‘${workspace.name}’에 초대할까요?`,
      detail: names.join(", "),
      action: "초대하기",
      run: async () => {
        await api.inviteFriends(workspace.id, [...picked]);
        toast(`${picked.size}명에게 초대를 보냈어요`);
        setPicked(new Set());
        emit("workspaces");
        onChanged();
      },
    });
  };

  const inviteEmail = () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setEmailError("이메일 주소를 확인해 주세요");
      return;
    }
    setConfirm({
      title: `${value}에 초대 메일을 보낼까요?`,
      detail: `‘${workspace.name}’ 초대 코드가 함께 가요`,
      action: "보내기",
      run: async () => {
        await api.inviteEmails(workspace.id, [value]);
        toast("초대 메일을 보냈어요");
        setEmail("");
        onChanged();
      },
    });
  };

  const resend = (row: InviteRow) =>
    setConfirm({
      title: `${row.person?.name ?? ""}님에게 초대를 다시 보낼까요?`,
      detail: "전에 보낸 초대는 쓸 수 없게 돼요",
      action: "다시 보내기",
      run: async () => {
        await api.resendInvite(workspace.id, row.kind, row.id);
        toast("초대를 다시 보냈어요");
        onChanged();
      },
    });

  return (
    <>
      <Sheet open={open} onClose={onClose} title="사람 초대" description={workspace.name}>
        <SectionHead title="친구" className="mt-4 mb-3" />
        <TextInput value={query} onChange={setQuery} search placeholder="이름이나 이메일로 찾기" name="friend-search" />
        <div className="mt-2">
          {failed ? <p className="py-4 text-body text-sub">{failed}</p> : null}
          {!friends && !failed ? <RowSkeleton rows={3} /> : null}
          {friends && candidates.length === 0 ? <p className="py-4 text-body text-sub">초대할 수 있는 친구가 없어요</p> : null}
          {friends && candidates.length > 0 && shown.length === 0 ? <p className="py-4 text-body text-sub">찾는 친구가 없어요</p> : null}
          {shown.map((friend) => {
            const pending = pendingByUser.get(friend.user_id);
            const person = friend.person!;
            if (pending) {
              return (
                <ListRow
                  key={friend.user_id}
                  leading={<Avatar id={person.id} />}
                  title={<Name name={person.name} email={person.email} duplicate={dup.has(person.name)} />}
                  subtitle="초대를 보냈어요"
                  trailing={
                    <Button tone="text" onClick={() => resend(pending)}>
                      다시 보내기
                    </Button>
                  }
                />
              );
            }
            return (
              <ListRow
                key={friend.user_id}
                onClick={() => toggle(friend.user_id)}
                leading={<Avatar id={person.id} />}
                title={<Name name={person.name} email={person.email} duplicate={dup.has(person.name)} />}
                trailing={<Check checked={picked.has(friend.user_id)} />}
              />
            );
          })}
          <ListRow
            onClick={() => {
              onClose();
              router.push("/friends?add=1");
            }}
            leading={
              <span className="inline-flex size-icon items-center justify-center rounded-full bg-surface">
                <Icon name="userPlus" />
              </span>
            }
            title="친구 추가하기"
          />
        </div>
        <div className="mt-4">
          <Button tone="fill" size="sheet" full disabled={picked.size === 0} onClick={inviteFriends}>
            {picked.size === 0 ? "초대할 친구를 골라 주세요" : `${picked.size}명 초대하기`}
          </Button>
        </div>

        <SectionHead title="이메일로 초대" className="mt-10 mb-3" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <TextInput
              value={email}
              onChange={(value) => {
                setEmail(value);
                setEmailError(null);
              }}
              placeholder="이메일 주소"
              type="email"
              error={emailError}
              onEnter={inviteEmail}
              name="invite-email"
            />
          </div>
          <Button tone="line" onClick={inviteEmail}>
            보내기
          </Button>
        </div>

        <div className="mt-10 flex items-center gap-4 pb-6">
          <div className="min-w-0 flex-1">
            <SectionHead title="초대 링크" />
            <p className="mt-1 text-detail text-sub">링크를 받은 사람은 바로 참여해요</p>
          </div>
          <Button tone="line" onClick={onCopyLink}>
            링크 복사
          </Button>
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
