import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    try {
      await writeAuditLog({
        actorId: user.id,
        action: "auth.sign_out",
        meta: { email: user.email },
      });
    } catch {
      // best-effort
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}
