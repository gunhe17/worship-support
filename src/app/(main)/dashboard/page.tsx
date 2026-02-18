import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <h2 className="text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">
        대시보드
      </h2>
      <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
        {user?.user_metadata?.name ?? user?.email}님, 환영합니다.
      </p>
    </div>
  );
}
