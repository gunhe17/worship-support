import { createClient } from "@/lib/supabase/server";

export async function writeAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  meta = {},
}: {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    meta,
  });
}
