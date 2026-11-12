"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, type Preview } from "@/lib/api";
import { emit } from "@/lib/events";
import { say } from "@/lib/messages";
import Button from "@/ui/Button";
import Popup, { type Confirm } from "@/ui/Popup";
import Sheet, { SheetActions } from "@/ui/Sheet";
import TextInput from "@/ui/TextInput";
import { toast } from "@/ui/Toaster";

export default function CodeSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    if (open) {
      setCode(initial ?? "");
      setError(null);
    }
  }, [open, initial]);

  const go = (workspaceId: string, text: string) => {
    emit("workspaces");
    router.push(`/space?id=${workspaceId}`);
    toast(text);
  };

  const check = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자를 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preview: Preview = await api.checkCode(code);
      if (preview.already_member) {
        onClose();
        go(preview.id, "이미 참여한 공간이에요");
        return;
      }
      setConfirm({
        title: `‘${preview.name}’에 참여할까요?`,
        detail: `관리자 ${preview.manager?.name ?? ""}님 · 구성원 ${preview.member_count}명`,
        action: "참여하기",
        run: async () => {
          const joined = await api.joinCode(code);
          onClose();
          go(joined.workspace.id, joined.already_member ? "이미 참여한 공간이에요" : `‘${joined.workspace.name}’에 참여했어요`);
        },
      });
    } catch (failure) {
      setError(say(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="초대 코드로 참여"
        description="초대 메일에 있는 6자리 숫자를 입력해 주세요"
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={onClose}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full onClick={check} busy={busy}>
              확인
            </Button>
          </SheetActions>
        }
      >
        <div className="pt-4">
          <TextInput value={code} onChange={setCode} code placeholder="000000" error={error} autoFocus onEnter={check} name="code" />
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
