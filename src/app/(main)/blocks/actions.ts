"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { FormState } from "@/lib/form-types";

const BLOCK_TYPES = [
  "txt",
  "image",
  "datetime",
  "song",
  "song_list",
  "advertisement",
  "background",
] as const;

type BlockType = (typeof BLOCK_TYPES)[number];

const BLOCK_NAME_MAX = 100;

function validateId(value: string | null): string | null {
  if (!value || !value.trim()) {
    return "잘못된 요청입니다.";
  }
  return null;
}

function validateBlockName(name: string | null): string | null {
  if (!name || !name.trim()) {
    return "블록 이름을 입력해주세요.";
  }
  if (name.trim().length > BLOCK_NAME_MAX) {
    return `블록 이름은 ${BLOCK_NAME_MAX}자 이하로 입력해주세요.`;
  }
  return null;
}

function validateBlockType(type: string | null): string | null {
  if (!type || !BLOCK_TYPES.includes(type as BlockType)) {
    return "유효하지 않은 블록 타입입니다.";
  }
  return null;
}

async function createVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    blockId: string;
    type: BlockType;
    formData?: FormData;
  }
): Promise<{ id: string } | null> {
  const { blockId, type, formData } = params;

  switch (type) {
    case "txt": {
      const content = (formData?.get("content") as string) ?? "";
      const title = (formData?.get("title") as string) ?? null;
      const description = (formData?.get("description") as string) ?? null;

      const { data } = await supabase
        .from("block_txt")
        .insert({
          block_id: blockId,
          title: title?.trim() || null,
          description: description?.trim() || null,
          content,
        })
        .select("id")
        .single();
      return data;
    }
    case "image": {
      const title = (formData?.get("title") as string) ?? null;
      const description = (formData?.get("description") as string) ?? null;
      const imagePath = (formData?.get("imagePath") as string) || "/placeholder-image.png";

      const { data } = await supabase
        .from("block_image")
        .insert({
          block_id: blockId,
          title: title?.trim() || null,
          description: description?.trim() || null,
          image_path: imagePath,
          crop: null,
        })
        .select("id")
        .single();
      return data;
    }
    case "datetime": {
      const title = (formData?.get("title") as string) ?? null;
      const description = (formData?.get("description") as string) ?? null;
      const startAt = (formData?.get("startAt") as string) || new Date().toISOString();
      const endAt = (formData?.get("endAt") as string) || null;

      const { data } = await supabase
        .from("block_datetime")
        .insert({
          block_id: blockId,
          title: title?.trim() || null,
          description: description?.trim() || null,
          start_at: startAt,
          end_at: endAt,
        })
        .select("id")
        .single();
      return data;
    }
    case "song": {
      const title = (formData?.get("title") as string) || "제목 없음";
      const description = (formData?.get("description") as string) ?? null;
      const referenceUrl = (formData?.get("referenceUrl") as string) ?? null;
      const musicalKey = (formData?.get("musicalKey") as string) ?? null;

      const { data } = await supabase
        .from("block_song")
        .insert({
          block_id: blockId,
          title: title.trim(),
          description: description?.trim() || null,
          reference_url: referenceUrl?.trim() || null,
          musical_key: musicalKey?.trim() || null,
        })
        .select("id")
        .single();
      return data;
    }
    case "song_list": {
      const title = (formData?.get("title") as string) ?? null;
      const description = (formData?.get("description") as string) ?? null;
      const referenceUrl = (formData?.get("referenceUrl") as string) ?? null;

      const { data } = await supabase
        .from("block_song_list")
        .insert({
          block_id: blockId,
          title: title?.trim() || null,
          description: description?.trim() || null,
          reference_url: referenceUrl?.trim() || null,
        })
        .select("id")
        .single();
      return data;
    }
    case "advertisement": {
      const title = (formData?.get("title") as string) || "광고";
      const description = (formData?.get("description") as string) || "";

      const { data } = await supabase
        .from("block_advertisement")
        .insert({
          block_id: blockId,
          title: title.trim(),
          description,
        })
        .select("id")
        .single();
      return data;
    }
    case "background": {
      const title = (formData?.get("title") as string) ?? null;
      const description = (formData?.get("description") as string) ?? null;
      const imagePath = (formData?.get("imagePath") as string) || "/placeholder-background.png";

      const { data } = await supabase
        .from("block_background")
        .insert({
          block_id: blockId,
          title: title?.trim() || null,
          description: description?.trim() || null,
          image_path: imagePath,
          crop: null,
        })
        .select("id")
        .single();
      return data;
    }
    default:
      return null;
  }
}

export async function createBlock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;

  const projectIdError = validateId(projectId);
  if (projectIdError) return { error: projectIdError, success: null };

  const nameError = validateBlockName(name);
  if (nameError) return { error: nameError, success: null };

  const typeError = validateBlockType(type);
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

  const { data: block, error } = await supabase
    .from("block")
    .insert({
      project_id: projectId,
      type,
      name: name.trim(),
      current_version_id: null,
    })
    .select("id, name, type")
    .single();

  if (error || !block) {
    return { error: "블록 생성에 실패했습니다.", success: null };
  }

  const version = await createVersion(supabase, {
    blockId: block.id,
    type: type as BlockType,
  });

  if (!version) {
    return { error: "초기 버전 생성에 실패했습니다.", success: null };
  }

  const { error: updateError } = await supabase
    .from("block")
    .update({ current_version_id: version.id })
    .eq("id", block.id)
    .is("deleted_at", null);

  if (updateError) {
    return { error: "블록 버전 연결에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "block.create",
    entityType: "block",
    entityId: block.id,
    meta: { name: block.name, type: block.type, projectId },
  }).catch(() => {});

  writeAuditLog({
    actorId: user.id,
    action: "block.version_create",
    entityType: "block",
    entityId: block.id,
    meta: { versionId: version.id },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}/blocks`);
  redirect(`/blocks/${block.id}`);
}

export async function updateBlockMeta(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

  const nameError = validateBlockName(name);
  if (nameError) return { error: nameError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data, error } = await supabase
    .from("block")
    .update({ name: name.trim() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id, name")
    .single();

  if (error) {
    return { error: "블록 수정에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "블록을 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "block.update_meta",
    entityType: "block",
    entityId: data.id,
    meta: { name: data.name },
  }).catch(() => {});

  revalidatePath(`/projects/${data.project_id}/blocks`);
  revalidatePath(`/blocks/${data.id}`);
  return { error: null, success: "블록 정보가 수정되었습니다." };
}

export async function saveBlockVersion(
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

  const { data: block } = await supabase
    .from("block")
    .select("id, project_id, type")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!block) {
    return { error: "블록을 찾을 수 없습니다.", success: null };
  }

  const version = await createVersion(supabase, {
    blockId: id,
    type: block.type as BlockType,
    formData,
  });

  if (!version) {
    return { error: "버전 저장에 실패했습니다.", success: null };
  }

  const { error: updateError } = await supabase
    .from("block")
    .update({ current_version_id: version.id })
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    return { error: "현재 버전 업데이트에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "block.version_create",
    entityType: "block",
    entityId: id,
    meta: { versionId: version.id },
  }).catch(() => {});

  writeAuditLog({
    actorId: user.id,
    action: "block.set_current",
    entityType: "block",
    entityId: id,
    meta: { versionId: version.id },
  }).catch(() => {});

  revalidatePath(`/blocks/${id}`);
  return { error: null, success: "새 버전이 저장되었습니다." };
}

export async function setBlockCurrentVersion(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id") as string;
  const versionId = formData.get("versionId") as string;

  const idError = validateId(id);
  if (idError) return { error: idError, success: null };

  const versionIdError = validateId(versionId);
  if (versionIdError) return { error: versionIdError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: block } = await supabase
    .from("block")
    .select("id, project_id, type")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!block) {
    return { error: "블록을 찾을 수 없습니다.", success: null };
  }

  let versionExists = false;

  switch (block.type) {
    case "txt": {
      const { data } = await supabase
        .from("block_txt")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "image": {
      const { data } = await supabase
        .from("block_image")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "datetime": {
      const { data } = await supabase
        .from("block_datetime")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "song": {
      const { data } = await supabase
        .from("block_song")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "song_list": {
      const { data } = await supabase
        .from("block_song_list")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "advertisement": {
      const { data } = await supabase
        .from("block_advertisement")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
    case "background": {
      const { data } = await supabase
        .from("block_background")
        .select("id")
        .eq("id", versionId)
        .eq("block_id", id)
        .single();
      versionExists = Boolean(data);
      break;
    }
  }

  if (!versionExists) {
    return { error: "해당 버전을 찾을 수 없습니다.", success: null };
  }

  const { error } = await supabase
    .from("block")
    .update({ current_version_id: versionId })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "현재 버전 변경에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "block.set_current",
    entityType: "block",
    entityId: id,
    meta: { versionId },
  }).catch(() => {});

  revalidatePath(`/blocks/${id}`);
  return { error: null, success: "현재 버전이 변경되었습니다." };
}

export async function addSongListItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const childBlockId = formData.get("childBlockId") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const childError = validateId(childBlockId);
  if (childError) return { error: childError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: parentBlock } = await supabase
    .from("block")
    .select("id, project_id, type")
    .eq("id", parentBlockId)
    .is("deleted_at", null)
    .single();

  if (!parentBlock || parentBlock.type !== "song_list") {
    return { error: "song_list 블록을 찾을 수 없습니다.", success: null };
  }

  const { data: childBlock } = await supabase
    .from("block")
    .select("id, project_id, type, name")
    .eq("id", childBlockId)
    .is("deleted_at", null)
    .single();

  if (!childBlock || childBlock.type !== "song") {
    return { error: "song 블록을 찾을 수 없습니다.", success: null };
  }

  if (parentBlock.project_id !== childBlock.project_id) {
    return {
      error: "같은 프로젝트의 song 블록만 추가할 수 있습니다.",
      success: null,
    };
  }

  const { data: existing } = await supabase
    .from("block_song_list_item")
    .select("id")
    .eq("parent_block_id", parentBlockId)
    .eq("child_block_id", childBlockId)
    .maybeSingle();

  if (existing) {
    return { error: "이미 추가된 song 블록입니다.", success: null };
  }

  const { data: lastItem } = await supabase
    .from("block_song_list_item")
    .select("sequence")
    .eq("parent_block_id", parentBlockId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastItem?.sequence ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("block_song_list_item")
    .insert({
      parent_block_id: parentBlockId,
      child_block_id: childBlockId,
      sequence: nextSequence,
    })
    .select("id")
    .single();

  if (error || !item) {
    return { error: "song_list 항목 추가에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "song_list.add_item",
    entityType: "block",
    entityId: parentBlockId,
    meta: {
      itemId: item.id,
      childBlockId,
      childBlockName: childBlock.name,
      sequence: nextSequence,
    },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "항목이 추가되었습니다." };
}

export async function removeSongListItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const itemId = formData.get("itemId") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const itemError = validateId(itemId);
  if (itemError) return { error: itemError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: deleted, error } = await supabase
    .from("block_song_list_item")
    .delete()
    .eq("id", itemId)
    .eq("parent_block_id", parentBlockId)
    .select("id, child_block_id")
    .single();

  if (error || !deleted) {
    return { error: "항목 삭제에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "song_list.remove_item",
    entityType: "block",
    entityId: parentBlockId,
    meta: { itemId: deleted.id, childBlockId: deleted.child_block_id },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "항목이 삭제되었습니다." };
}

export async function reorderSongListItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const itemId = formData.get("itemId") as string;
  const direction = formData.get("direction") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const itemError = validateId(itemId);
  if (itemError) return { error: itemError, success: null };

  if (direction !== "up" && direction !== "down") {
    return { error: "유효하지 않은 정렬 방향입니다.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: items } = await supabase
    .from("block_song_list_item")
    .select("id, sequence, child_block_id")
    .eq("parent_block_id", parentBlockId)
    .order("sequence", { ascending: true });

  if (!items || items.length === 0) {
    return { error: "정렬할 항목이 없습니다.", success: null };
  }

  const currentIndex = items.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) {
    return { error: "대상 항목을 찾을 수 없습니다.", success: null };
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return { error: "더 이상 이동할 수 없습니다.", success: null };
  }

  const currentItem = items[currentIndex];
  const targetItem = items[targetIndex];

  const { error: updateCurrentError } = await supabase
    .from("block_song_list_item")
    .update({ sequence: targetItem.sequence })
    .eq("id", currentItem.id)
    .eq("parent_block_id", parentBlockId);

  if (updateCurrentError) {
    return { error: "정렬 변경에 실패했습니다.", success: null };
  }

  const { error: updateTargetError } = await supabase
    .from("block_song_list_item")
    .update({ sequence: currentItem.sequence })
    .eq("id", targetItem.id)
    .eq("parent_block_id", parentBlockId);

  if (updateTargetError) {
    return { error: "정렬 변경에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "song_list.reorder",
    entityType: "block",
    entityId: parentBlockId,
    meta: {
      itemId: currentItem.id,
      from: currentIndex,
      to: targetIndex,
      direction,
    },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "순서가 변경되었습니다." };
}

export async function addAdvertisementItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const childBlockId = formData.get("childBlockId") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const childError = validateId(childBlockId);
  if (childError) return { error: childError, success: null };

  if (parentBlockId === childBlockId) {
    return { error: "동일한 블록은 추가할 수 없습니다.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: parentBlock } = await supabase
    .from("block")
    .select("id, project_id, type")
    .eq("id", parentBlockId)
    .is("deleted_at", null)
    .single();

  if (!parentBlock || parentBlock.type !== "advertisement") {
    return { error: "advertisement 블록을 찾을 수 없습니다.", success: null };
  }

  const { data: childBlock } = await supabase
    .from("block")
    .select("id, project_id, type, name")
    .eq("id", childBlockId)
    .is("deleted_at", null)
    .single();

  if (!childBlock) {
    return { error: "자식 블록을 찾을 수 없습니다.", success: null };
  }

  if (parentBlock.project_id !== childBlock.project_id) {
    return {
      error: "같은 프로젝트의 블록만 추가할 수 있습니다.",
      success: null,
    };
  }

  const { data: existing } = await supabase
    .from("block_advertisement_item")
    .select("id")
    .eq("parent_block_id", parentBlockId)
    .eq("child_block_id", childBlockId)
    .maybeSingle();

  if (existing) {
    return { error: "이미 추가된 블록입니다.", success: null };
  }

  const { data: lastItem } = await supabase
    .from("block_advertisement_item")
    .select("sequence")
    .eq("parent_block_id", parentBlockId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (lastItem?.sequence ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("block_advertisement_item")
    .insert({
      parent_block_id: parentBlockId,
      child_block_id: childBlockId,
      sequence: nextSequence,
    })
    .select("id")
    .single();

  if (error || !item) {
    return { error: "advertisement 항목 추가에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "advertisement.add_item",
    entityType: "block",
    entityId: parentBlockId,
    meta: {
      itemId: item.id,
      childBlockId,
      childBlockName: childBlock.name,
      sequence: nextSequence,
    },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "항목이 추가되었습니다." };
}

export async function removeAdvertisementItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const itemId = formData.get("itemId") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const itemError = validateId(itemId);
  if (itemError) return { error: itemError, success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: deleted, error } = await supabase
    .from("block_advertisement_item")
    .delete()
    .eq("id", itemId)
    .eq("parent_block_id", parentBlockId)
    .select("id, child_block_id")
    .single();

  if (error || !deleted) {
    return { error: "항목 삭제에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "advertisement.remove_item",
    entityType: "block",
    entityId: parentBlockId,
    meta: { itemId: deleted.id, childBlockId: deleted.child_block_id },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "항목이 삭제되었습니다." };
}

export async function reorderAdvertisementItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parentBlockId = formData.get("parentBlockId") as string;
  const itemId = formData.get("itemId") as string;
  const direction = formData.get("direction") as string;

  const parentError = validateId(parentBlockId);
  if (parentError) return { error: parentError, success: null };

  const itemError = validateId(itemId);
  if (itemError) return { error: itemError, success: null };

  if (direction !== "up" && direction !== "down") {
    return { error: "유효하지 않은 정렬 방향입니다.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다.", success: null };
  }

  const { data: items } = await supabase
    .from("block_advertisement_item")
    .select("id, sequence, child_block_id")
    .eq("parent_block_id", parentBlockId)
    .order("sequence", { ascending: true });

  if (!items || items.length === 0) {
    return { error: "정렬할 항목이 없습니다.", success: null };
  }

  const currentIndex = items.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) {
    return { error: "대상 항목을 찾을 수 없습니다.", success: null };
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return { error: "더 이상 이동할 수 없습니다.", success: null };
  }

  const currentItem = items[currentIndex];
  const targetItem = items[targetIndex];

  const { error: updateCurrentError } = await supabase
    .from("block_advertisement_item")
    .update({ sequence: targetItem.sequence })
    .eq("id", currentItem.id)
    .eq("parent_block_id", parentBlockId);

  if (updateCurrentError) {
    return { error: "정렬 변경에 실패했습니다.", success: null };
  }

  const { error: updateTargetError } = await supabase
    .from("block_advertisement_item")
    .update({ sequence: currentItem.sequence })
    .eq("id", targetItem.id)
    .eq("parent_block_id", parentBlockId);

  if (updateTargetError) {
    return { error: "정렬 변경에 실패했습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "advertisement.reorder",
    entityType: "block",
    entityId: parentBlockId,
    meta: {
      itemId: currentItem.id,
      from: currentIndex,
      to: targetIndex,
      direction,
    },
  }).catch(() => {});

  revalidatePath(`/blocks/${parentBlockId}`);
  return { error: null, success: "순서가 변경되었습니다." };
}

export async function deleteBlock(
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
    .from("block")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id, name, type")
    .single();

  if (error) {
    return { error: "블록 삭제에 실패했습니다.", success: null };
  }

  if (!data) {
    return { error: "블록을 찾을 수 없습니다.", success: null };
  }

  writeAuditLog({
    actorId: user.id,
    action: "block.soft_delete",
    entityType: "block",
    entityId: id,
    meta: { name: data.name, type: data.type },
  }).catch(() => {});

  revalidatePath(`/projects/${data.project_id}/blocks`);
  redirect(`/projects/${data.project_id}/blocks`);
}
