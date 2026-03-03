"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function toNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDuplicateError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || error.message?.includes("duplicate") === true;
}

export async function createTemplate(
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

  revalidatePath(`/projects/${projectId}/templates`);
  redirect(`/templates/${data.id}`);
}

export async function updateTemplate(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

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

  const { data, error } = await supabase
    .from("template")
    .update({ name: name.trim(), type })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id, name, type")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return { error: "이미 같은 이름의 템플릿이 존재합니다.", success: null };
    }
    return { error: "템플릿 수정에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "템플릿을 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "template.update",
    entityType: "template",
    entityId: data.id,
    meta: { name: data.name, type: data.type },
  }).catch(() => {});

  revalidatePath(`/projects/${data.project_id}/templates`);
  revalidatePath(`/templates/${data.id}`);
  return { error: null, success: "템플릿이 수정되었습니다." };
}

export async function deleteTemplate(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("template")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id, name, type")
    .single();

  if (error) {
    return { error: "템플릿 삭제에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "템플릿을 찾을 수 없습니다.", success: null };
  }

  await supabase
    .from("render")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("template_id", id)
    .is("deleted_at", null);

  writeAuditLog({
    actorId: user.id,
    action: "template.soft_delete",
    entityType: "template",
    entityId: data.id,
    meta: { name: data.name, type: data.type },
  }).catch(() => {});

  revalidatePath(`/projects/${data.project_id}/templates`);
  redirect(`/projects/${data.project_id}/templates`);
}

export async function restoreTemplate(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("template")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id, project_id, name, type")
    .single();

  if (error) {
    return { error: "템플릿 복구에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "복구할 템플릿을 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "template.restore",
    entityType: "template",
    entityId: data.id,
    meta: { name: data.name, type: data.type },
  }).catch(() => {});

  revalidatePath(`/projects/${data.project_id}/templates`);
  return { error: null, success: "템플릿이 복구되었습니다." };
}

export async function createRender(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const templateId = formData.get("templateId") as string;
  const blockId = formData.get("blockId") as string;

  const x = toNumber(formData.get("x"), 0);
  const y = toNumber(formData.get("y"), 0);
  const z = toNumber(formData.get("z"), 0);
  const width = toNumber(formData.get("width"), 100);
  const height = toNumber(formData.get("height"), 100);

  const templateIdError = validateId(templateId);
  if (templateIdError) return { error: templateIdError, success: null };

  const blockIdError = validateId(blockId);
  if (blockIdError) return { error: blockIdError, success: null };

  if (width <= 0 || height <= 0) {
    return { error: "크기(width, height)는 0보다 커야 합니다.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: template } = await supabase
    .from("template")
    .select("id, project_id")
    .eq("id", templateId)
    .is("deleted_at", null)
    .single();

  if (!template) {
    return { error: "템플릿을 찾을 수 없습니다.", success: null };
  }

  const { data: block } = await supabase
    .from("block")
    .select("id, project_id, name")
    .eq("id", blockId)
    .is("deleted_at", null)
    .single();

  if (!block) {
    return { error: "블록을 찾을 수 없습니다.", success: null };
  }

  if (block.project_id !== template.project_id) {
    return {
      error: "템플릿과 블록의 프로젝트가 일치하지 않습니다.",
      success: null,
    };
  }

  const { data, error } = await supabase
    .from("render")
    .insert({
      template_id: templateId,
      block_id: blockId,
      location: { x, y, z },
      size: { width, height },
    })
    .select("id")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        error: "이미 해당 블록이 템플릿에 배치되어 있습니다.",
        success: null,
      };
    }
    return { error: "렌더 추가에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "render.create",
    entityType: "render",
    entityId: data.id,
    meta: { templateId, blockId, blockName: block.name, location: { x, y, z }, size: { width, height } },
  }).catch(() => {});

  revalidatePath(`/templates/${templateId}`);
  return { error: null, success: "렌더가 추가되었습니다." };
}

export async function deleteRender(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("render")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, template_id, block_id")
    .single();

  if (error) {
    return { error: "렌더 삭제에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "렌더를 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "render.delete",
    entityType: "render",
    entityId: data.id,
    meta: { templateId: data.template_id, blockId: data.block_id },
  }).catch(() => {});

  revalidatePath(`/templates/${data.template_id}`);
  return { error: null, success: "렌더가 삭제되었습니다." };
}
