"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import AdminBadge from "@/ui/AdminBadge";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import SpaceIcon from "@/ui/SpaceIcon";
import TextInput from "@/ui/TextInput";

export default function NewSpace() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("공간 이름을 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setCreated(await api.createWorkspace(name.trim()));
      emit("workspaces");
    } catch (failure) {
      setError(say(failure));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <main className="flex min-h-dvh flex-col items-center px-gutter pt-28 text-center">
        <div className="enter-pop">
          <SpaceIcon name={created.name} size={72} />
        </div>
        <h1 className="enter-fade mt-6 text-title font-bold">‘{created.name}’ 공간을 만들었어요</h1>
        <div className="enter-pop mt-3 flex items-center justify-center gap-2 text-detail text-sub [animation-delay:200ms]">
          <AdminBadge />이 공간의 관리자가 되었어요
        </div>
        <div className="mt-10 flex w-full max-w-[320px] flex-col items-center gap-2">
          <Button tone="fill" full onClick={() => router.replace(`/space/manage?id=${created.id}&invite=1`)}>
            함께할 사람 초대하기
          </Button>
          <Button tone="quiet" onClick={() => router.replace(`/?created=${created.id}`)}>
            나중에 할게요
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-gutter pt-3">
      <button type="button" aria-label="닫기" onClick={() => router.back()} className="press -ml-3 inline-flex size-11 items-center justify-center">
        <Icon name="close" size={26} />
      </button>
      <h1 className="mt-6 text-title font-bold">새 공간</h1>
      <p className="mt-1 text-detail text-sub">함께 콘티를 만들 팀 공간이에요</p>
      <div className="mt-6">
        <TextInput
          label="공간 이름"
          value={name}
          onChange={(value) => {
            setName(value);
            setError(null);
          }}
          placeholder="예: 청년부 찬양팀"
          maxLength={20}
          hint="20자까지 쓸 수 있어요"
          error={error}
          autoFocus
          onEnter={submit}
          name="space-name"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button tone="fill" onClick={submit} busy={busy}>
          만들기
        </Button>
      </div>
    </main>
  );
}
