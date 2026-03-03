import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LegacyTemplateEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string; templateid?: string; template1d?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const templateId = (resolved.templateId ?? resolved.templateid ?? resolved.template1d)?.trim();

  if (!templateId) {
    notFound();
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("template")
    .select("id, project_id")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  redirect(`/project/${template.project_id}/template/${template.id}/editor`);
}
