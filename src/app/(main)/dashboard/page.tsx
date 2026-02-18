import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <h2 className="text-xl font-bold">대시보드</h2>
      <p className="mt-2 text-zinc-500">
        {user?.email}님, 환영합니다.
      </p>
    </div>
  );
}
