"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { api, type Preview } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import Button from "@/ui/Button";
import Skeleton from "@/ui/Skeleton";
import SpaceIcon from "@/ui/SpaceIcon";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

export default function JoinLink() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { data, error, loading } = useLoad<Preview>(() => api.checkLink(token), [token]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const joined = await api.joinLink(token);
      emit("workspaces");
      router.replace(`/space?id=${joined.workspace.id}`);
      toast(joined.already_member ? "이미 참여한 공간이에요" : `‘${joined.workspace.name}’에 참여했어요`);
    } catch (failure) {
      setFailed(say(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-gutter pt-20">
      <p className="text-home-title font-extrabold tracking-tight">Worship</p>
      {loading && !data && !error ? (
        <div className="mt-10">
          <Skeleton className="size-[72px] rounded-space" />
          <Skeleton className="mt-6 h-6 w-48" />
        </div>
      ) : null}
      {error ? (
        <div className="enter-fade mt-10">
          <h1 className="text-title font-bold">들어갈 수 없는 링크예요</h1>
          <p className="mt-2 text-detail text-sub">{error}</p>
          <div className="mt-6">
            <Button tone="line" onClick={() => router.replace("/")}>
              홈으로
            </Button>
          </div>
        </div>
      ) : null}
      {data ? (
        <div className="enter-fade mt-10">
          <SpaceIcon name={data.name} size={72} />
          <h1 className="mt-6 text-title font-bold">‘{data.name}’에 초대받았어요</h1>
          <p className="mt-1 text-detail text-sub">
            관리자 {data.manager?.name ?? ""}님 · 구성원 {data.member_count}명
          </p>
          <p className="mt-6 text-detail text-sub">들어가면 내 이름과 이메일이 이 공간 사람들에게 보여요</p>
          {failed ? <p className="mt-3 text-body text-danger">{failed}</p> : null}
          <div className="mt-6">
            <Button tone="fill" size="sheet" full busy={busy} onClick={data.already_member ? () => router.replace(`/space?id=${data.id}`) : join}>
              {data.already_member ? "공간으로 가기" : "참여하기"}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
