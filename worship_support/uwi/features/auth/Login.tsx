"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { demoPeople } from "@/lib/demo";
import Avatar from "@/ui/Avatar";
import Button from "@/ui/Button";
import ListRow from "@/ui/ListRow";
import TextInput from "@/ui/TextInput";

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (as?: { email: string; name: string }) => {
    setBusy(true);
    setError(null);
    try {
      await api.developLogin(as?.email ?? email, as?.name ?? name);
      router.replace(params.get("next") || "/");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "로그인하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-gutter pt-16">
      <p className="text-home-title font-extrabold tracking-tight">Worship</p>
      <h1 className="mt-8 text-title font-bold">개발용 로그인</h1>
      <p className="mt-1 text-detail text-sub">소셜 로그인을 붙이기 전까지 이메일로 계정을 만들어 들어가요</p>
      <div className="mt-8 space-y-4">
        <TextInput label="이메일" value={email} onChange={setEmail} placeholder="name@example.com" type="email" name="email" />
        <TextInput label="이름" value={name} onChange={setName} placeholder="처음 들어올 때만 써요" maxLength={30} name="name" error={error} onEnter={() => submit()} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button tone="fill" onClick={() => submit()} busy={busy} disabled={!email.includes("@")}>
          들어가기
        </Button>
      </div>
      <h2 className="mt-12 text-head font-semibold text-sub">시연용 사용자로 들어가기</h2>
      <div className="mt-1">
        {demoPeople.map((person) => (
          <ListRow
            key={person.email}
            onClick={() => submit(person)}
            leading={<Avatar id={person.email} />}
            title={person.name}
            subtitle={person.email}
          />
        ))}
      </div>
    </main>
  );
}

