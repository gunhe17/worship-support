import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {children}
    </div>
  );
}
