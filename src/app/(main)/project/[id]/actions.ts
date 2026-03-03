"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { FormState } from "@/lib/form-types";

const TEMPLATE_NAME_MAX = 100;
const TEMPLATE_TYPES = ["card-news", "presentation"] as const;
type TemplateType = (typeof TEMPLATE_TYPES)[number];

function validateId(value: string | null): string | null {
  if (!value || !value.trim()) {
    return "잘못된 요청입니다.";
  }
  return null;
}

function validateTemplateName(name: string | null): string | null {
  if (!name || !name.trim()) {
    return "템플릿 이름을 입력해주세요.";
  }
  if (name.trim().length > TEMPLATE_NAME_MAX) {
    return `템플릿 이름은 ${TEMPLATE_NAME_MAX}자 이하로 입력해주세요.`;
  }
  return null;
}

function validateTemplateType(type: string | null): string | null {
  if (!type || !TEMPLATE_TYPES.includes(type as TemplateType)) {
    return "유효하지 않은 템플릿 타입입니다.";
  }
  return null;
}

function isDuplicateError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || error.message?.includes("duplicate") === true;
}

export async function createTemplateInProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;

  const projectIdError = validateId(projectId);
  if (projectIdError) return { error: projectIdError, success: null };

  const nameError = validateTemplateName(name);
  if (nameError) return { error: nameError, success: null };

  const typeError = validateTemplateType(type);
  if (typeError) return { error: typeError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: project } = await supabase
    .from("project")
    .select("id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    return { error: "프로젝트를 찾을 수 없습니다.", success: null };
  }

  const { data, error } = await supabase
    .from("template")
    .insert({
      project_id: projectId,
      name: name.trim(),
      type,
    })
    .select("id, name, type")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return { error: "이미 같은 이름의 템플릿이 존재합니다.", success: null };
    }
    return { error: "템플릿 생성에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "template.create",
    entityType: "template",
    entityId: data.id,
    meta: { name: data.name, type: data.type, projectId },
  }).catch(() => {});

  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/projects/${projectId}/templates`);

  return { error: null, success: "템플릿이 생성되었습니다." };
}
