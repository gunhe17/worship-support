"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { AuthFormState } from "@/lib/auth-types";

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요.", success: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", success: null };
  }

  // audit log는 응답을 블로킹하지 않도록 fire-and-forget
  writeAuditLog({
    actorId: data.user.id,
    action: "auth.sign_in",
    meta: { email },
  }).catch(() => {});

  revalidatePath("/", "layout");
  redirect("/home");
}
