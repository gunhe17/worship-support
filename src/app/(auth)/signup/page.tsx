import { signup } from "./actions";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <form className="flex w-full max-w-sm flex-col gap-4 p-8">
        <h1 className="text-2xl font-bold">회원가입</h1>
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border px-3 py-2"
        />
        <label htmlFor="password" className="text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="rounded-md border px-3 py-2"
        />
        <button
          formAction={signup}
          className="rounded-md bg-foreground px-4 py-2 text-background"
        >
          회원가입
        </button>
        <p className="text-center text-sm text-zinc-500">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="font-medium text-foreground underline">
            로그인
          </a>
        </p>
      </form>
    </div>
  );
}
