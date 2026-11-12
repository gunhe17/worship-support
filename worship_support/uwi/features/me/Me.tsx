"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import TopBar from "@/features/shell/TopBar";
import { api, type Device, type Me as MeData } from "@/lib/api";
import { say } from "@/lib/messages";
import { ago } from "@/lib/time";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import ListRow from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet, { SheetActions } from "@/ui/Sheet";
import Skeleton, { RowSkeleton } from "@/ui/Skeleton";
import { Failed } from "@/ui/State";
import TextInput from "@/ui/TextInput";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

const providers: Record<string, string> = { GOOGLE: "Google", KAKAO: "카카오", APPLE: "Apple" };

export default function Me() {
  const router = useRouter();
  const { data, error, loading, reload } = useLoad<MeData>(() => api.me());
  const [sheet, setSheet] = useState<"accounts" | "devices" | "name" | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const openDevices = async () => {
    setSheet("devices");
    setDevices(null);
    try {
      setDevices(await api.devices());
    } catch (failure) {
      toast(say(failure));
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      setNameError("이름을 입력해 주세요");
      return;
    }
    try {
      await api.rename(name.trim());
      setSheet(null);
      toast("이름을 바꿨어요");
      reload();
    } catch (failure) {
      setNameError(say(failure));
    }
  };

  return (
    <main className="pb-10">
      <TopBar title="내 정보" />
      <div className="px-gutter">
        {error && !data ? <Failed message={error} onRetry={reload} /> : null}
        <div className="mt-6 flex items-center gap-4">
          {data ? <Avatar id={data.id} size={64} /> : <span className="skeleton block size-profile rounded-full" />}
          <div className="min-w-0 flex-1">
            {loading && !data ? (
              <>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-2 h-4 w-40" />
              </>
            ) : (
              <>
                <p className="truncate text-title font-bold">{data?.name}</p>
                <p className="truncate text-detail text-sub">{data?.email ?? ""}</p>
              </>
            )}
          </div>
        </div>

        <SectionHead title="계정" className="mt-10" />
        <ListRow onClick={() => setSheet("accounts")} leading={<Icon name="link" />} title={<span className="font-normal">연결된 계정</span>} trailing={<Chevron />} />
        <ListRow onClick={openDevices} leading={<Icon name="phone" />} title={<span className="font-normal">로그인된 기기</span>} trailing={<Chevron />} />
        <ListRow
          onClick={() => {
            setName(data?.name ?? "");
            setNameError(null);
            setSheet("name");
          }}
          leading={<Icon name="pencil" />}
          title={<span className="font-normal">이름 바꾸기</span>}
        />

        <SectionHead title="기타" className="mt-8" />
        <ListRow
          onClick={() =>
            setConfirm({
              title: "로그아웃할까요?",
              action: "로그아웃",
              danger: true,
              run: async () => {
                await api.logout();
                router.replace("/login");
              },
            })
          }
          leading={<Icon name="logout" />}
          title={<span className="font-normal">로그아웃</span>}
        />

        <div className="mt-10">
          <Button
            tone="quiet"
            onClick={() =>
              setConfirm({
                title: "탈퇴할까요?",
                detail: "모든 공간에서 나가고 친구 관계가 끝나요. 되돌릴 수 없어요",
                action: "탈퇴",
                danger: true,
                run: async () => {
                  await api.withdraw();
                  router.replace("/login");
                },
              })
            }
          >
            탈퇴하기
          </Button>
        </div>
      </div>

      <Sheet open={sheet === "accounts"} onClose={() => setSheet(null)} title="연결된 계정" description="이 계정으로 로그인할 수 있어요">
        {(data?.social_accounts ?? []).map((account) => (
          <ListRow key={account.id} title={providers[account.provider] ?? account.provider} subtitle={account.email ?? "이메일 없음"} />
        ))}
      </Sheet>

      <Sheet open={sheet === "devices"} onClose={() => setSheet(null)} title="로그인된 기기" description="7일 동안 쓰지 않으면 로그아웃돼요">
        {!devices ? <RowSkeleton rows={2} /> : null}
        {(devices ?? []).map((device) => (
          <ListRow
            key={device.id}
            leading={<Icon name="phone" />}
            title={<span className="truncate font-normal">{label(device.device_label)}</span>}
            subtitle={device.current ? "지금 이 기기" : `마지막 사용 ${ago(device.last_used_at)}`}
            trailing={
              device.current ? null : (
                <Button
                  tone="line"
                  size="row"
                  onClick={async () => {
                    try {
                      await api.revokeDevice(device.id);
                      setDevices((current) => current?.filter((item) => item.id !== device.id) ?? null);
                      toast("그 기기에서 로그아웃했어요");
                    } catch (failure) {
                      toast(say(failure));
                    }
                  }}
                >
                  로그아웃
                </Button>
              )
            }
          />
        ))}
      </Sheet>

      <Sheet
        open={sheet === "name"}
        onClose={() => setSheet(null)}
        title="이름 바꾸기"
        description="다른 사람이 알아볼 수 있는 이름을 써 주세요"
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setSheet(null)}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full onClick={saveName}>
              저장
            </Button>
          </SheetActions>
        }
      >
        <div className="pt-4">
          <TextInput value={name} onChange={(value) => { setName(value); setNameError(null); }} maxLength={30} error={nameError} autoFocus onEnter={saveName} name="person-name" />
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function Chevron() {
  return <Icon name="chevronRight" size={22} className="shrink-0 text-faint" />;
}

function label(agent: string | null): string {
  if (!agent) return "알 수 없는 기기";
  if (/iPhone/.test(agent)) return "iPhone";
  if (/iPad/.test(agent)) return "iPad";
  if (/Android/.test(agent)) return "Android 휴대폰";
  if (/Macintosh/.test(agent)) return "Mac";
  if (/Windows/.test(agent)) return "Windows PC";
  return agent.slice(0, 40);
}
