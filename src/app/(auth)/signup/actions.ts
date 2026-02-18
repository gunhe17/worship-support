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
    return { error: "회원가입에 실패했습니다. 이미 등록된 이메일일 수 있습니다.", success: null };
  }

  // 이메일 확인이 활성화된 경우 처리
  if (data.user && data.user.identities?.length === 0) {
    return { error: null, success: "확인 이메일을 발송했습니다. 이메일을 확인해주세요." };
  }

  try {
    await writeAuditLog({
      actorId: data.user?.id ?? null,
      action: "auth.sign_up",
      meta: { email, name },
    });
  } catch {
    // best-effort
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
