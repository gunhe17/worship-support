"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { demoPeople } from "@/lib/demo";
import Avatar from "@/ui/Avatar";
import ListRow from "@/ui/ListRow";
import Sheet from "@/ui/Sheet";

export default function Switcher() {
  const path = usePathname() ?? "/";
  const [me, setMe] = useState<{ name: string; email: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mails, setMails] = useState<Array<{ subject: string; body: string; sent_at: string }>>([]);

  useEffect(() => {
    if (path.startsWith("/login")) return;
    api.me().then(setMe).catch(() => setMe(null));
  }, [path]);

  if (path.startsWith("/login") || !me) return null;

  const switchTo = async (email: string, name: string) => {
    setBusy(true);
    await api.developLogin(email, name).catch(() => undefined);
    window.location.href = "/";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          api
            .devMail()
            .then((all) => setMails(all.filter((mail) => mail.to === me.email)))
            .catch(() => setMails([]));
        }}
        className="press fixed right-3 bottom-[calc(var(--spacing-tab)+12px+env(safe-area-inset-bottom))] z-[35] rounded-full bg-toast px-3 py-2 text-badge font-bold text-white"
      >
        {me.name} ▾ 사용자 바꾸기
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="사용자 바꾸기" description="시연용. 누르면 그 사람으로 바로 들어가요">
        <h3 className="mt-4 text-head font-semibold text-sub">{me.name}님이 받은 초대 메일 {mails.length}</h3>
        {mails.length === 0 ? <p className="py-3 text-body text-sub">받은 초대 메일이 없어요</p> : null}
        {mails.map((mail) => {
          const code = mail.body.match(/(\d{6})$/)?.[1];
          return (
            <div key={mail.sent_at} className="my-2 rounded-surface bg-surface p-4">
              <p className="text-name font-semibold">{mail.subject}</p>
              <p className="mt-1 text-detail text-sub">{mail.body}</p>
              {code ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/?code=1&value=${code}`;
                  }}
                  className="press mt-3 inline-flex h-button-row items-center rounded-full bg-primary px-4 text-body font-semibold text-white"
                >
                  메일의 코드로 참여하기
                </button>
              ) : null}
            </div>
          );
        })}
        <h3 className="mt-6 text-head font-semibold text-sub">다른 사람으로 바꾸기</h3>
        {demoPeople.map((person) => (
          <ListRow
            key={person.email}
            onClick={busy ? undefined : () => switchTo(person.email, person.name)}
            leading={<Avatar id={person.email} />}
            title={person.name}
            subtitle={person.email === me.email ? `${person.email} · 지금 사용자` : person.email}
          />
        ))}
      </Sheet>
    </>
  );
}
