"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "./actions";
import type { AuthFormState } from "@/lib/auth-types";
import { AuthLayout } from "@/components/auth-layout";
import { FormInput } from "@/components/form-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/alert";

const initialState: AuthFormState = { error: null, success: null };

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <AuthLayout
      title="비밀번호 재설정"
      showLogo={false}
      boxed={false}
      footer={
        <p className="mt-6 text-center text-sm/6 text-gray-600 dark:text-gray-400">
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200">
            &larr; 로그인으로 돌아가기
          </Link>
        </p>
      }
    >
      <form action={formAction} className="space-y-6">
        <Alert message={state.error} variant="error" />
        <Alert message={state.success} variant="success" />

        <FormInput label="이메일" id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />

        <SubmitButton pendingText="전송 중...">재설정하기</SubmitButton>
      </form>
    </AuthLayout>
  );
}
