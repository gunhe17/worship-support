import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Worship Support</h1>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-md border px-3 py-1 text-sm"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
