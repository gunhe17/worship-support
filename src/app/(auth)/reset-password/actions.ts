"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/auth-types";

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return { error: "모든 필드를 입력해주세요.", success: null };
  }

  if (password.length < 6) {
    return { error: "비밀번호는 최소 6자 이상이어야 합니다.", success: null };
  }

  if (password !== confirmPassword) {
    return { error: "비밀번호가 일치하지 않습니다.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "비밀번호 변경에 실패했습니다. 다시 시도해주세요.", success: null };
  }

  redirect("/dashboard");
}
