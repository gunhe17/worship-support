"use client";

import { useActionState } from "react";
import { createBlock } from "@/app/(main)/blocks/actions";
import { Alert, FormInput, FormSelect, SubmitButton } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function CreateBlockForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(createBlock, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="sm:col-span-3">
        <Alert message={state.error} variant="error" />
      </div>
      <div className="sm:col-span-2">
        <FormInput
          label="블록 이름"
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="설교 본문"
        />
      </div>
      <div>
        <FormSelect
          label="타입"
          id="type"
          name="type"
          options={[
            { value: "txt", label: "txt" },
            { value: "image", label: "image" },
            { value: "datetime", label: "datetime" },
            { value: "song", label: "song" },
            { value: "song_list", label: "song_list" },
            { value: "advertisement", label: "advertisement" },
            { value: "background", label: "background" },
          ]}
        />
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <SubmitButton pendingText="생성 중...">블록 생성</SubmitButton>
      </div>
    </form>
  );
}
