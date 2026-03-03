"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthFormState } from "@/lib/auth-types";

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "모든 필드를 입력해주세요.", success: null };
  }

  if (password.length < 6) {
    return { error: "비밀번호는 최소 6자 이상이어야 합니다.", success: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return { error: `회원가입에 실패했습니다: ${error.message}`, success: null };
  }

  // identities가 비어있으면 이미 등록된 이메일
  if (data.user && data.user.identities?.length === 0) {
    return { error: "이미 등록된 이메일입니다. 로그인을 시도해주세요.", success: null };
  }

  // audit log는 응답을 블로킹하지 않도록 fire-and-forget
  writeAuditLog({
    actorId: data.user?.id ?? null,
    action: "auth.sign_up",
    meta: { email, name },
  }).catch(() => {});

  revalidatePath("/", "layout");
  redirect("/home");
}
