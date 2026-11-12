"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import SubHeader from "@/features/shell/SubHeader";
import { api, type Group, type Member, type SpaceDetail } from "@/lib/api";
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
import Sheet, { SheetActions } from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import { Failed } from "@/ui/State";
import TextInput from "@/ui/TextInput";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

type Data = { space: SpaceDetail; groups: Group[]; members: Member[] };

export default function Settings() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error, loading, reload } = useLoad<Data>(async () => {
    const [space, groups, members] = await Promise.all([api.workspace(id), api.groups(id), api.members(id)]);
    return { space, groups, members };
  }, [id]);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [successor, setSuccessor] = useState<Member | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    if (data) setName(data.space.name);
  }, [data]);

  if (error && !data) {
    return (
      <main>
        <SubHeader title="공간 설정" back={`/space?id=${id}`} />
        <div className="px-gutter">
          <Failed message={error} onRetry={reload} />
        </div>
      </main>
    );
  }

  const others = (data?.members ?? []).filter((member) => !member.me);
  const dup = duplicated(others.map((member) => member.person));

  const saveName = async () => {
    if (!name.trim()) {
      setNameError("공간 이름을 입력해 주세요");
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await api.renameWorkspace(id, name.trim());
      emit("workspaces");
      toast("공간 이름을 바꿨어요");
      reload();
    } catch (failure) {
      setNameError(say(failure));
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      setGroupError("그룹 이름을 입력해 주세요");
      return;
    }
    try {
      await api.createGroup(id, groupName.trim());
      setGroupOpen(false);
      setGroupName("");
      toast("그룹을 만들었어요");
      reload();
    } catch (failure) {
      setGroupError(say(failure));
    }
  };

  const transfer = () => {
    if (!successor || !data) return;
    setConfirm({
      title: `${successor.person?.name ?? ""}님에게 관리자를 넘길까요?`,
      detail: `‘${data.space.name}’ · 넘기면 나는 일반 구성원이 돼요`,
      action: "넘기기",
      run: async () => {
        await api.transfer(id, successor.id);
        setTransferOpen(false);
        emit("workspaces");
        toast(`${successor.person?.name ?? ""}님이 관리자가 되었어요`);
        router.replace(`/space?id=${id}`);
      },
    });
  };

  const close = async () => {
    if (!data) return;
    if (confirmName.trim() !== data.space.name) {
      setCloseError("공간 이름이 맞지 않아요");
      return;
    }
    setClosing(true);
    setCloseError(null);
    try {
      await api.closeWorkspace(id, confirmName.trim());
      window.localStorage.removeItem("worship:last-space");
      emit("workspaces");
      router.replace("/");
      toast(`‘${data.space.name}’ 공간을 삭제했어요`);
    } catch (failure) {
      setCloseError(say(failure));
    } finally {
      setClosing(false);
    }
  };

  return (
    <main className="pb-12">
      <SubHeader title="공간 설정" description={data?.space.name ?? " "} back={`/space?id=${id}`} />
      <div className="px-gutter">
        {loading && !data ? <RowSkeleton rows={4} /> : null}
        {data ? (
          <div className="enter-fade">
            <div className="mt-8">
              <TextInput
                label="공간 이름"
                value={name}
                onChange={(value) => {
                  setName(value);
                  setNameError(null);
                }}
                maxLength={20}
                hint="20자까지 쓸 수 있어요"
                error={nameError}
                onEnter={saveName}
                name="space-name"
              />
              <div className="mt-3 flex justify-end">
                <Button tone="fill" onClick={saveName} busy={saving} disabled={name.trim() === data.space.name}>
                  이름 저장
                </Button>
              </div>
            </div>

            <SectionHead title="그룹" count={data.groups.length} className="mt-10" />
            <p className="mt-1 mb-1 text-detail text-sub">문서 권한을 줄 때 여러 사람을 한 번에 고르는 묶음이에요</p>
            {data.groups.map((group) => (
              <ListRow key={group.id} title={group.name} subtitle={`${group.member_count}명`} />
            ))}
            <ListRow
              onClick={() => {
                setGroupError(null);
                setGroupName("");
                setGroupOpen(true);
              }}
              leading={<Icon name="plus" />}
              title={<span className="font-normal">그룹 만들기</span>}
            />

            <SectionHead title="관리자" className="mt-10" />
            <ListRow
              onClick={() => {
                setSuccessor(null);
                setTransferOpen(true);
              }}
              leading={<Icon name="swap" />}
              title={<span className="font-normal">관리자 넘기기</span>}
              subtitle="넘기면 나는 일반 구성원이 돼요"
            />

            <div className="mt-12">
              <Button
                tone="quiet"
                onClick={() => {
                  setConfirmName("");
                  setCloseError(null);
                  setCloseOpen(true);
                }}
              >
                공간 삭제
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Sheet
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        title="그룹 만들기"
        description={data?.space.name}
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setGroupOpen(false)}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full onClick={createGroup}>
              만들기
            </Button>
          </SheetActions>
        }
      >
        <div className="pt-4">
          <TextInput value={groupName} onChange={(value) => { setGroupName(value); setGroupError(null); }} placeholder="예: 보컬" maxLength={50} error={groupError} autoFocus onEnter={createGroup} name="group-name" />
        </div>
      </Sheet>

      <Sheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="관리자 넘기기"
        description="새 관리자를 골라 주세요"
        stickyFooter={others.length > 5}
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setTransferOpen(false)}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full disabled={!successor} onClick={transfer}>
              넘기기
            </Button>
          </SheetActions>
        }
      >
        {others.length === 0 ? <p className="py-4 text-body text-sub">넘길 수 있는 구성원이 없어요</p> : null}
        {others.map((member) => (
          <ListRow
            key={member.id}
            onClick={() => setSuccessor(member)}
            leading={<Avatar id={member.user_id} />}
            title={<Name name={member.person?.name ?? ""} email={member.person?.email} duplicate={dup.has(member.person?.name ?? "")} />}
            trailing={<Check checked={successor?.id === member.id} />}
          />
        ))}
      </Sheet>

      <Sheet
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="공간 삭제"
        description={data?.space.name}
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setCloseOpen(false)}>
              취소
            </Button>
            <Button tone="danger" size="sheet" full onClick={close} busy={closing}>
              삭제
            </Button>
          </SheetActions>
        }
      >
        <ul className="mt-4 space-y-2 text-body">
          <li>· 구성원 {data?.space.member_count ?? 0}명이 더 이상 이 공간을 볼 수 없어요</li>
          <li>· 보낸 초대와 초대 링크는 쓸 수 없게 돼요</li>
          <li>· 구성원에게 삭제 알림이 가요</li>
        </ul>
        <div className="mt-6">
          <TextInput
            label="확인을 위해 공간 이름을 입력해 주세요"
            value={confirmName}
            onChange={(value) => {
              setConfirmName(value);
              setCloseError(null);
            }}
            placeholder={data?.space.name}
            error={closeError}
            name="confirm-name"
          />
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}
