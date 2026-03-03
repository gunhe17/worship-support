"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { FormState } from "@/lib/form-types";

const NAME_MIN = 1;
const NAME_MAX = 100;

function validateProjectId(id: string | null): string | null {
  if (!id || !id.trim()) {
    return "잘못된 요청입니다.";
  }
  return null;
}

function validateName(name: string | null): string | null {
  if (!name || name.trim().length < NAME_MIN) {
    return "프로젝트 이름을 입력해주세요.";
  }
  if (name.trim().length > NAME_MAX) {
    return `프로젝트 이름은 ${NAME_MAX}자 이하로 입력해주세요.`;
  }
  return null;
}

function isDuplicateError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || error.message?.includes("duplicate") === true;
}

export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = formData.get("name") as string;
  const nameError = validateName(name);
  if (nameError) {
    return { error: nameError, success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("project")
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return { error: "이미 같은 이름의 프로젝트가 존재합니다.", success: null };
    }
    return { error: "프로젝트 생성에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.create",
    entityType: "project",
    entityId: data.id,
    meta: { name: data.name },
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { error: null, success: "프로젝트가 생성되었습니다." };
}

export async function updateProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const idError = validateProjectId(id);
  if (idError) {
    return { error: idError, success: null };
  }
  const nameError = validateName(name);
  if (nameError) {
    return { error: nameError, success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("project")
    .update({ name: name.trim() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return { error: "이미 같은 이름의 프로젝트가 존재합니다.", success: null };
    }
    return { error: "프로젝트 수정에 실패했습니다.", success: null };
  }
  if (!data) {
    return { error: "프로젝트를 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.update",
    entityType: "project",
    entityId: id,
    meta: { name: name.trim() },
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { error: null, success: "프로젝트가 수정되었습니다." };
}

export async function deleteProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const idError = validateProjectId(id);
  if (idError) {
    return { error: idError, success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("project")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name")
    .single();

  if (error) {
    return { error: "프로젝트 삭제에 실패했습니다.", success: null };
  }
  if (!data) {
    return { error: "프로젝트를 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.soft_delete",
    entityType: "project",
    entityId: id,
    meta: { name: data.name },
  }).catch(() => {});

  revalidatePath("/", "layout");
  return redirect("/projects");
}

export async function restoreProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const idError = validateProjectId(id);
  if (idError) {
    return { error: idError, success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("project")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id, name")
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        error: "같은 이름의 활성 프로젝트가 이미 존재하여 복구할 수 없습니다.",
        success: null,
      };
    }
    return { error: "프로젝트 복구에 실패했습니다.", success: null };
  }
  if (!data) {
    return { error: "복구할 프로젝트를 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "project.restore",
    entityType: "project",
    entityId: id,
    meta: { name: data.name },
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { error: null, success: "프로젝트가 복구되었습니다." };
}
