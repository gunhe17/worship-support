"use server";

import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/auth-types";

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "이메일을 입력해주세요.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: "비밀번호 재설정 요청에 실패했습니다.", success: null };
  }

  // 이메일 존재 여부와 관계없이 성공 메시지 표시 (이메일 열거 방지)
  return {
    error: null,
    success: "비밀번호 재설정 링크를 이메일로 보냈습니다. 이메일을 확인해주세요.",
  };
}
