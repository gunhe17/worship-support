"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { api, type Relation } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Skeleton from "@/ui/Skeleton";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

const states: Partial<Record<Relation, string>> = {
  friend: "이미 친구예요",
  sent: "친구 요청을 보냈어요. 수락을 기다리는 중이에요",
  received: "나에게 친구 요청을 보냈어요. 요청을 보내면 바로 친구가 돼요",
  blocked: "친구 요청을 보낼 수 없는 사람이에요",
};

export default function FriendLink() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { data, error, reload } = useLoad(() => api.friendByLink(token, "check"), [token]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const result = await api.friendByLink(token, "request");
      emit("friends");
      toast(result.result === "accepted" ? `${result.owner.name}님과 친구가 되었어요` : "친구 요청을 보냈어요");
      void reload();
    } catch (failure) {
      setFailed(say(failure));
    } finally {
      setBusy(false);
    }
  };

  const relation = data?.relation ?? "none";
  const can = data && !data.me && (relation === "none" || relation === "received");

  return (
    <main className="flex min-h-dvh flex-col px-gutter pt-20">
      <p className="text-home-title font-extrabold tracking-tight">Worship</p>
      {!data && !error ? <Skeleton className="mt-10 size-profile rounded-full" /> : null}
      {error ? (
        <div className="enter-fade mt-10">
          <h1 className="text-title font-bold">쓸 수 없는 친구 링크예요</h1>
          <p className="mt-2 text-detail text-sub">링크를 보낸 사람에게 새 링크를 받아 주세요</p>
        </div>
      ) : null}
      {data ? (
        <div className="enter-fade mt-10">
          <Avatar id={data.owner.id} size={64} />
          <h1 className="mt-6 text-title font-bold">{data.me ? "내 친구 링크예요" : `${data.owner.name}님의 친구 링크예요`}</h1>
          <p className="mt-1 text-detail text-sub">{data.me ? "이 링크를 친구에게 보내 주세요" : states[relation] ?? "요청을 보내고 상대가 수락하면 서로 친구가 돼요"}</p>
          {failed ? <p className="mt-3 text-body text-danger">{failed}</p> : null}
          <div className="mt-6 flex flex-col items-start gap-2">
            {can ? (
              <Button tone="fill" size="sheet" full busy={busy} onClick={request}>
                친구 요청 보내기
              </Button>
            ) : null}
            <Button tone={can ? "quiet" : "line"} onClick={() => router.replace("/friends")}>
              친구 목록으로
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
