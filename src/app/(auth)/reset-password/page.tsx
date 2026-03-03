"use client";

import { useActionState } from "react";
import { updatePassword } from "./actions";
import type { AuthFormState } from "@/lib/auth-types";
import { AuthLayout } from "@/components/auth-layout";
import { FormInput } from "@/components/form-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/alert";

const initialState: AuthFormState = { error: null, success: null };

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <AuthLayout
      title="새 비밀번호 설정"
      subtitle="새로운 비밀번호를 입력하세요."
    >
      <form action={formAction} className="space-y-6">
        <Alert message={state.error} variant="error" />

        <FormInput label="새 비밀번호" id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="6자 이상" />
        <FormInput label="비밀번호 확인" id="confirmPassword" name="confirmPassword" type="password" required minLength={6} autoComplete="new-password" />

        <SubmitButton pendingText="변경 중...">비밀번호 변경</SubmitButton>
      </form>
    </AuthLayout>
  );
}
