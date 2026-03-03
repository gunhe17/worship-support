"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "./actions";
import type { AuthFormState } from "@/lib/auth-types";
import { AuthLayout } from "@/components/auth-layout";
import { FormInput } from "@/components/form-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/alert";

const initialState: AuthFormState = { error: null, success: null };

export default function SignupPage() {
  const [state, formAction] = useActionState(signup, initialState);

  return (
    <AuthLayout
      title="회원가입"
      showLogo={false}
      boxed={false}
      footer={
        <p className="mt-6 text-center text-sm/6 text-gray-600 dark:text-gray-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200">
            로그인
          </Link>
        </p>
      }
    >
      <form action={formAction} className="space-y-6">
        <Alert message={state.error} variant="error" />
        <Alert message={state.success} variant="success" />

        <FormInput label="이름" id="name" name="name" type="text" required placeholder="홍길동" />
        <FormInput label="이메일" id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        <FormInput label="비밀번호" id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="6자 이상" />

        <SubmitButton pendingText="처리 중...">회원가입</SubmitButton>
      </form>
    </AuthLayout>
  );
}
