"use client";

import { useState } from "react";

import AdminBadge from "@/ui/AdminBadge";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import Check from "@/ui/Check";
import Icon from "@/ui/Icon";
import ListRow, { Name } from "@/ui/ListRow";
import Notice from "@/ui/Notice";
import Popup, { type Confirm } from "@/ui/Popup";
import SectionHead from "@/ui/SectionHead";
import Sheet, { SheetActions } from "@/ui/Sheet";
import { RowSkeleton } from "@/ui/Skeleton";
import SpaceIcon from "@/ui/SpaceIcon";
import { Empty, Failed } from "@/ui/State";
import Surface from "@/ui/Surface";
import TextInput from "@/ui/TextInput";
import { toast } from "@/ui/Toaster";

export default function DesignCheck() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [text, setText] = useState("");
  const [code, setCode] = useState("123456");
  const [checked, setChecked] = useState(true);
  return (
    <main className="space-y-8 px-gutter py-8">
      <h1 className="text-title font-bold">부품 점검</h1>
      <section className="space-y-3">
        <SectionHead title="버튼" />
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="fill">주 버튼</Button>
          <Button tone="line">보조 버튼</Button>
          <Button tone="text">다시 보내기</Button>
          <Button tone="quiet">공간 삭제</Button>
          <Button tone="fill" disabled>
            누를 수 없음
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="fill" size="row">
            수락
          </Button>
          <Button tone="line" size="row">
            삭제
          </Button>
          <Button tone="danger" size="sheet">
            삭제
          </Button>
        </div>
      </section>
      <section>
        <SectionHead title="목록 줄" />
        <ListRow leading={<Avatar id="0" />} title={<Name name="김민수" email="minsu.kim@gmail.com" duplicate />} subtitle="청년부 찬양팀 외 1곳" trailing={<Icon name="more" className="text-faint" />} />
        <ListRow leading={<Avatar id="1" />} title="최예린" subtitle="청년부 찬양팀" />
        <ListRow leading={<Avatar id="2" />} title="정하늘" onClick={() => setChecked(!checked)} trailing={<Check checked={checked} />} />
        <ListRow href="#" leading={<SpaceIcon name="청년부 찬양팀" />} title={<><span>청년부 찬양팀</span><AdminBadge /></>} subtitle="내가 관리 · 구성원 9명" />
        <ListRow leading={<SpaceIcon name="새벽기도 찬양팀" pending />} title="새벽기도 찬양팀" subtitle="박하은님이 초대했어요" trailing={<Button tone="fill" size="row">참여하기</Button>} />
      </section>
      <Surface>
        <p className="text-name font-semibold">묶음 면</p>
        <p className="text-detail text-sub">면 한 겹, 테두리 없음</p>
      </Surface>
      <Notice icon="bell" count={2} title="응답할 알림 2개" action="알림에서 답하기" onAction={() => undefined} onClose={() => undefined} />
      <section className="space-y-4">
        <SectionHead title="입력칸" />
        <TextInput label="공간 이름" value={text} onChange={setText} placeholder="예: 청년부 찬양팀" hint="20자까지 쓸 수 있어요" maxLength={20} />
        <TextInput value="같은 이름" onChange={() => undefined} error="같은 이름의 공간에 이미 참여하고 있어요" />
        <TextInput value={code} onChange={setCode} code />
        <TextInput value="" onChange={() => undefined} search placeholder="이름이나 이메일로 찾기" />
      </section>
      <section>
        <SectionHead title="불러오는 중 · 빈 화면 · 오류" />
        <RowSkeleton rows={2} />
        <Empty text="아직 친구가 없어요" action="친구 추가하기" onAction={() => undefined} />
        <Failed message="연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요" onRetry={() => undefined} />
      </section>
      <div className="flex flex-wrap gap-3">
        <Button tone="line" onClick={() => setSheet(true)}>
          시트 열기
        </Button>
        <Button tone="line" onClick={() => setConfirm({ title: "‘새벽기도 찬양팀’에 참여할까요?", detail: "관리자 박하은님 · 구성원 3명", action: "참여하기", run: async () => toast("참여했어요") })}>
          확인 창 열기
        </Button>
        <Button tone="line" onClick={() => toast("초대를 보냈어요")}>
          토스트
        </Button>
      </div>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="초대 코드로 참여"
        description="초대 메일에 있는 6자리 숫자를 입력해 주세요"
        footer={
          <SheetActions>
            <Button tone="line" size="sheet" full onClick={() => setSheet(false)}>
              취소
            </Button>
            <Button tone="fill" size="sheet" full onClick={() => setSheet(false)}>
              확인
            </Button>
          </SheetActions>
        }
      >
        <div className="pt-4">
          <TextInput value={code} onChange={setCode} code />
        </div>
      </Sheet>
      <Popup confirm={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}
