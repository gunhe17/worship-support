"use client";

import { useEffect, useState } from "react";

import { api, type Person } from "@/lib/api";
import { copy } from "@/lib/clipboard";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import { duplicated } from "@/lib/names";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import ListRow, { Name } from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import { toast } from "@/ui/Toaster";

type Candidate = { person: Person; spaces: string[] };

export default function AddFriendSheet({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    if (!open) return;
    setCandidates(null);
    setFailed(null);
    (async () => {
      const { spaces } = await api.workspaces();
      const lists = await Promise.all(spaces.map((space) => api.members(space.id).then((members) => ({ space, members }))));
      const found = new Map<string, Candidate>();
      for (const { space, members } of lists) {
        for (const member of members) {
          if (member.me || member.relation !== "none" || !member.person) continue;
          const current = found.get(member.user_id) ?? { person: member.person, spaces: [] };
          current.spaces.push(space.name);
          found.set(member.user_id, current);
        }
      }
      setCandidates([...found.values()].sort((a, b) => a.person.name.localeCompare(b.person.name, "ko")));
    })().catch((failure) => setFailed(say(failure)));
  }, [open]);

  const copyLink = async (mode: "get" | "replace") => {
    try {
      const link = await api.friendLink(mode);
      const copied = await copy(`${window.location.origin}/friend-link?token=${link.token}`);
      toast(copied ? (mode === "replace" ? "새 링크를 복사했어요. 전에 보낸 링크는 쓸 수 없어요" : "친구 링크를 복사했어요") : "복사하지 못했어요");
    } catch (failure) {
      toast(say(failure));
    }
  };

  const request = (candidate: Candidate) =>
    setConfirm({
      title: `${candidate.person.name}님에게 친구 요청을 보낼까요?`,
      detail: "수락하면 서로 친구가 돼요",
      action: "보내기",
      run: async () => {
        const result = await api.requestFriend(candidate.person.id);
        toast(result.result === "accepted" ? `${candidate.person.name}님과 친구가 되었어요` : "친구 요청을 보냈어요");
        setCandidates((current) => current?.filter((item) => item.person.id !== candidate.person.id) ?? null);
        emit("friends");
        onChanged();
      },
    });

  const dup = duplicated((candidates ?? []).map((candidate) => candidate.person));

  return (
    <>
      <Sheet open={open} onClose={onClose} title="친구 추가" description="링크를 보내거나 같은 공간 사람에게 요청해요">
        <div className="mt-4 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <SectionHead title="내 친구 링크" />
            <p className="mt-1 text-detail text-sub">링크를 연 사람이 나에게 친구 요청을 보낼 수 있어요</p>
          </div>
          <Button tone="line" onClick={() => copyLink("get")}>
            링크 복사
          </Button>
        </div>
        <button type="button" onClick={() => copyLink("replace")} className="press min-h-11 text-body font-medium text-sub">
          새 링크로 바꾸기
        </button>

        <SectionHead title="같은 공간 사람" className="mt-8 mb-1" />
        {failed ? <p className="py-4 text-body text-sub">{failed}</p> : null}
        {!candidates && !failed ? <RowSkeleton rows={3} /> : null}
        {candidates && candidates.length === 0 ? <p className="py-4 text-body text-sub">요청을 보낼 수 있는 사람이 없어요</p> : null}
        {(candidates ?? []).map((candidate) => (
          <ListRow
            key={candidate.person.id}
            leading={<Avatar id={candidate.person.id} />}
            title={<Name name={candidate.person.name} email={candidate.person.email} duplicate={dup.has(candidate.person.name)} />}
            subtitle={candidate.spaces.length > 1 ? `${candidate.spaces[0]} 외 ${candidate.spaces.length - 1}곳` : candidate.spaces[0]}
            trailing={
              <Button tone="line" size="row" onClick={() => request(candidate)}>
                요청
              </Button>
            }
          />
        ))}
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
