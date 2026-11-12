"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import Back from "@/features/shell/Back";
import Bell from "@/features/shell/Bell";
import { api, type Doc, type Space as SpaceRow, type SpaceDetail } from "@/lib/api";
import { say } from "@/lib/messages";
import { day } from "@/lib/time";
import SectionHead from "@/ui/SectionHead";
import { SheetActions } from "@/ui/Sheet";
import TextInput from "@/ui/TextInput";
import { emit } from "@/lib/events";
import AdminBadge from "@/ui/AdminBadge";
import Button from "@/ui/Button";
import Icon from "@/ui/Icon";
import ListRow from "@/ui/ListRow";
import Popup, { type Confirm } from "@/ui/Popup";
import Sheet from "@/ui/Sheet";
import Skeleton from "@/ui/Skeleton";
import SpaceIcon from "@/ui/SpaceIcon";
import { Empty, Failed } from "@/ui/State";
import { toast } from "@/ui/Toaster";
import useLoad from "@/ui/useLoad";

const LAST_KEY = "worship:last-space";

export default function Space() {
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState<string | null>(params.get("id"));
  const [switching, setSwitching] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const spaces = useLoad<SpaceRow[]>(async () => (await api.workspaces()).spaces);

  useEffect(() => {
    const fromQuery = params.get("id");
    if (fromQuery) {
      setId(fromQuery);
      return;
    }
    if (!spaces.data) return;
    const last = window.localStorage.getItem(LAST_KEY);
    const pick = spaces.data.find((space) => space.id === last) ?? spaces.data[0];
    setId(pick ? pick.id : null);
  }, [params, spaces.data]);

  const detail = useLoad<SpaceDetail | null>(async () => (id ? api.workspace(id) : null), [id]);
  const docs = useLoad<Doc[]>(async () => (id ? api.documents(id) : []), [id]);
  const [creating, setCreating] = useState(false);
  const [docName, setDocName] = useState("");
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const createDoc = async () => {
    if (!id) return;
    if (!docName.trim()) {
      setDocError("문서 이름을 입력해 주세요");
      return;
    }
    setDocBusy(true);
    try {
      const made = await api.createDocument(id, docName.trim());
      setCreating(false);
      toast(`‘${made.name}’ 문서를 만들었어요`);
      void docs.reload();
    } catch (failure) {
      setDocError(say(failure));
    } finally {
      setDocBusy(false);
    }
  };

  useEffect(() => {
    if (detail.data) window.localStorage.setItem(LAST_KEY, detail.data.id);
  }, [detail.data]);

  if (spaces.data && spaces.data.length === 0 && !params.get("id")) {
    return (
      <main>
        <Header />
        <div className="px-gutter">
          <Empty text="아직 참여한 공간이 없어요" action="새 공간 만들기" onAction={() => router.push("/new-space")} />
        </div>
      </main>
    );
  }

  const space = detail.data;
  const leave = () =>
    space &&
    setConfirm({
      title: `‘${space.name}’에서 나갈까요?`,
      detail: "다시 들어오려면 초대를 받아야 해요",
      action: "나가기",
      danger: true,
      run: async () => {
        await api.leave(space.id);
        window.localStorage.removeItem(LAST_KEY);
        emit("workspaces");
        router.replace("/");
        toast(`‘${space.name}’에서 나갔어요`);
      },
    });

  return (
    <main>
      <Header>
        {space ? (
          <button type="button" onClick={() => setSwitching(true)} className="press flex min-w-0 items-center gap-3 text-left" aria-label="공간 바꾸기">
            <SpaceIcon name={space.name} />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-title font-bold">{space.name}</span>
                <Icon name="chevronDown" size={20} className="shrink-0 text-faint" />
              </span>
              <span className="block text-detail text-sub">공간 바꾸기</span>
            </span>
          </button>
        ) : (
          <span className="flex items-center gap-3">
            <Skeleton className="size-icon rounded-space" />
            <Skeleton className="h-5 w-36" />
          </span>
        )}
      </Header>
      <div className="px-gutter">
        {detail.error ? <Failed message={detail.error} onRetry={detail.reload} /> : null}
        {space ? (
          <div className="enter-fade mt-4">
            {space.role === "MANAGER" ? (
              <>
                <ListRow
                  href={`/space/manage?id=${space.id}`}
                  leading={<Round name="people" />}
                  title={
                    <>
                      <span>구성원 관리</span>
                      <AdminBadge />
                    </>
                  }
                  subtitle={`사람 초대 · 보낸 초대 · 구성원 ${space.member_count}명`}
                />
                <ListRow href={`/space/settings?id=${space.id}`} leading={<Round name="settings" />} title="공간 설정" subtitle="공간 이름 · 그룹 · 관리자 넘기기 · 공간 삭제" />
              </>
            ) : (
              <ListRow
                href={`/space/manage?id=${space.id}`}
                leading={<Round name="people" />}
                title="구성원"
                subtitle={`관리자 ${space.manager?.name ?? ""} · 구성원 ${space.member_count}명`}
              />
            )}
            <SectionHead
              title="문서"
              count={docs.data?.length ?? 0}
              className="mt-8 mb-1"
              trailing={
                <Button
                  tone="line"
                  size="row"
                  onClick={() => {
                    setDocName("");
                    setDocError(null);
                    setCreating(true);
                  }}
                >
                  <Icon name="plus" size={18} />새 문서
                </Button>
              }
            />
            {docs.data && docs.data.length === 0 ? <p className="py-3 text-body text-sub">아직 문서가 없어요</p> : null}
            {(docs.data ?? []).map((doc) => (
              <ListRow
                key={doc.id}
                leading={<Round name="doc" />}
                title={<span className="truncate">{doc.name}</span>}
                subtitle={doc.locked ? "권한 없음" : `${doc.my_role === "OWNER" ? "내가 만듦" : doc.owner_name ?? ""} · ${day(doc.updated_at)}`}
              />
            ))}
            {space.role === "MEMBER" ? (
              <div className="mt-10">
                <Button tone="quiet" onClick={leave}>
                  공간 나가기
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Sheet open={switching} onClose={() => setSwitching(false)} title="공간 바꾸기">
        {spaces.error ? <p className="py-4 text-body text-sub">{spaces.error}</p> : null}
        {(spaces.data ?? []).map((row) => (
          <ListRow
            key={row.id}
            onClick={() => {
              setSwitching(false);
              router.replace(`/space?id=${row.id}`);
            }}
            leading={<SpaceIcon name={row.name} />}
            title={
              <>
                <span className="truncate">{row.name}</span>
                {row.role === "MANAGER" ? <AdminBadge /> : null}
              </>
            }
            subtitle={row.id === id ? "지금 보고 있는 공간" : `구성원 ${row.member_count}명`}
          />
        ))}
        <div className="mt-2 flex items-center gap-4 pb-2">
          <Button tone="line" onClick={() => router.push("/new-space")}>
            <Icon name="plus" size={20} />새 공간
          </Button>
          <Link href="/?code=1" className="press text-body text-sub underline underline-offset-4">
            초대 코드로 참여
          </Link>
        </div>
      </Sheet>
      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="새 문서"
        description={space?.name}
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setCreating(false)}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full busy={docBusy} onClick={createDoc}>
              만들기
            </Button>
          </SheetActions>
        }
      >
        <div className="pt-4">
          <TextInput value={docName} onChange={(value) => { setDocName(value); setDocError(null); }} placeholder="예: 11월 16일 주일 콘티" maxLength={50} error={docError} autoFocus onEnter={createDoc} name="doc-name" />
          <p className="mt-3 px-2 text-detail text-sub">문서 안의 내용(콘티 구성)은 설계가 정해지면 붙어요</p>
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex min-h-20 items-center justify-between gap-3 px-gutter pt-4">
      <Back />
      <div className="min-w-0 flex-1">{children ?? <h1 className="text-home-title font-extrabold">공간</h1>}</div>
      <Bell />
    </header>
  );
}

function Round({ name }: { name: string }) {
  return (
    <span className="inline-flex size-icon shrink-0 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name={name} />
    </span>
  );
}
