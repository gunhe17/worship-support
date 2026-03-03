"use client";

import { useActionState } from "react";
import { saveBlockVersion } from "../actions";
import { Alert, FormInput, FormTextarea, SubmitButton } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

function getText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function BlockVersionForm({
  block,
  currentVersion,
}: {
  block: { id: string; type: string };
  currentVersion: Record<string, unknown> | null;
}) {
  const [state, formAction] = useActionState(saveBlockVersion, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={block.id} />
      <Alert message={state.error} variant="error" />
      <Alert message={state.success} variant="success" />

      {block.type === "txt" && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            defaultValue={getText(currentVersion?.description)}
          />
          <FormTextarea
            label="본문"
            id="content"
            name="content"
            required
            rows={8}
            defaultValue={getText(currentVersion?.content)}
          />
        </>
      )}

      {(block.type === "image" || block.type === "background") && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            defaultValue={getText(currentVersion?.description)}
          />
          <FormInput
            label="이미지 경로"
            id="imagePath"
            name="imagePath"
            type="text"
            required
            defaultValue={getText(currentVersion?.image_path)}
            placeholder="/uploads/your-image.png"
          />
        </>
      )}

      {block.type === "datetime" && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            defaultValue={getText(currentVersion?.description)}
          />
          <FormInput
            label="시작 시각"
            id="startAt"
            name="startAt"
            type="datetime-local"
            required
            defaultValue={getText(currentVersion?.start_at).slice(0, 16)}
          />
          <FormInput
            label="종료 시각"
            id="endAt"
            name="endAt"
            type="datetime-local"
            defaultValue={getText(currentVersion?.end_at).slice(0, 16)}
          />
        </>
      )}

      {block.type === "song" && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            required
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            defaultValue={getText(currentVersion?.description)}
          />
          <FormInput
            label="참고 링크"
            id="referenceUrl"
            name="referenceUrl"
            type="text"
            defaultValue={getText(currentVersion?.reference_url)}
          />
          <FormInput
            label="키"
            id="musicalKey"
            name="musicalKey"
            type="text"
            defaultValue={getText(currentVersion?.musical_key)}
          />
        </>
      )}

      {block.type === "song_list" && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            defaultValue={getText(currentVersion?.description)}
          />
          <FormInput
            label="참고 링크"
            id="referenceUrl"
            name="referenceUrl"
            type="text"
            defaultValue={getText(currentVersion?.reference_url)}
          />
        </>
      )}

      {block.type === "advertisement" && (
        <>
          <FormInput
            label="제목"
            id="title"
            name="title"
            type="text"
            required
            defaultValue={getText(currentVersion?.title)}
          />
          <FormTextarea
            label="설명"
            id="description"
            name="description"
            required
            defaultValue={getText(currentVersion?.description)}
          />
        </>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingText="저장 중...">새 버전 저장</SubmitButton>
      </div>
    </form>
  );
}
