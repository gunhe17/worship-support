"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRender } from "../actions";
import { Alert, FormInput, FormSelect, SubmitButton, Toast } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function RenderCreateForm({
  templateId,
  blocks,
}: {
  templateId: string;
  blocks: Array<{ id: string; name: string; type: string }>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(createRender, initialState);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const toastOpen = Boolean(state.success && state.success !== dismissedSuccessMessage);

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [router, state.success]);

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={() => setDismissedSuccessMessage(null)}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <Alert message={state.error} variant="error" />
      <Toast
        open={toastOpen}
        message={state.success}
        onClose={() => setDismissedSuccessMessage(state.success)}
        variant="success"
      />

      <FormSelect
        label="블록"
        id="blockId"
        name="blockId"
        options={blocks.map((block) => ({
          value: block.id,
          label: `${block.name || "이름 없음"} (${block.type})`,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput label="x" id="x" name="x" type="number" defaultValue={0} required />
        <FormInput label="y" id="y" name="y" type="number" defaultValue={0} required />
        <FormInput label="z" id="z" name="z" type="number" defaultValue={0} required />
        <FormInput
          label="width"
          id="width"
          name="width"
          type="number"
          defaultValue={100}
          min={1}
          required
        />
        <FormInput
          label="height"
          id="height"
          name="height"
          type="number"
          defaultValue={100}
          min={1}
          required
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingText="추가 중...">렌더 추가</SubmitButton>
      </div>
    </form>
  );
}
