"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signup } from "./actions";
import type { AuthFormState } from "@/lib/auth-types";

const initialState: AuthFormState = { error: null, success: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full justify-center rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500 disabled:opacity-50"
    >
      {pending ? "처리 중..." : "회원가입"}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useActionState(signup, initialState);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center bg-white px-6 py-12 dark:bg-gray-900 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">
          회원가입
        </h2>
        <p className="mt-2 text-center text-sm/6 text-gray-500 dark:text-gray-400">
          계정을 만들고 시작하세요.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form action={formAction} className="space-y-6">
          {state.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm/6 text-red-600 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800">
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="rounded-md bg-green-50 p-3 text-sm/6 text-green-600 ring-1 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800">
              {state.success}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
              이름
            </label>
            <div className="mt-2">
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="홍길동"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
              이메일
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
              비밀번호
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="6자 이상"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 sm:text-sm/6"
              />
            </div>
          </div>

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}
