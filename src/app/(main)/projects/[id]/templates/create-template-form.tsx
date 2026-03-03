"use client";

import { useActionState } from "react";
import { createTemplate } from "@/app/(main)/templates/actions";
import { Alert, FormInput, FormSelect, SubmitButton } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function CreateTemplateForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(createTemplate, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="sm:col-span-3">
        <Alert message={state.error} variant="error" />
      </div>
      <div className="sm:col-span-2">
        <FormInput
          label="템플릿 이름"
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="주일예배 순서"
        />
      </div>
      <div>
        <FormSelect
          label="타입"
          id="type"
          name="type"
          options={[
            { value: "card-news", label: "card-news" },
            { value: "presentation", label: "presentation" },
          ]}
        />
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <SubmitButton pendingText="생성 중...">템플릿 생성</SubmitButton>
      </div>
    </form>
  );
}
