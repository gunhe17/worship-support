"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import type { AuthFormState } from "@/lib/auth-types";
import { AuthLayout } from "@/components/auth-layout";
import { FormInput } from "@/components/form-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/alert";

const initialState: AuthFormState = { error: null, success: null };

function ErrorFromUrl() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  return <Alert message={error} variant="error" />;
}

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <AuthLayout
      title="로그인"
      showLogo={false}
      boxed={false}
      footer={
        <p className="mt-6 text-center text-sm/6 text-gray-600 dark:text-gray-400">
          계정이 없으신가요?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            회원가입
          </Link>
        </p>
      }
    >
      <form action={formAction} className="space-y-6">
        <Suspense>
          <ErrorFromUrl />
        </Suspense>
        <Alert message={state.error} variant="error" />

        <FormInput
          label="이메일"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100"
            >
              비밀번호
            </label>
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          </div>
          <div className="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:placeholder:text-gray-500 dark:focus:outline-gray-400 sm:text-sm/6"
            />
          </div>
        </div>

        <SubmitButton pendingText="로그인 중...">로그인</SubmitButton>
      </form>
    </AuthLayout>
  );
}
