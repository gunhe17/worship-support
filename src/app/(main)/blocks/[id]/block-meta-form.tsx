"use client";

import { useActionState } from "react";
import { deleteBlock, updateBlockMeta } from "../actions";
import { Alert, Button, FormInput, SubmitButton } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function BlockMetaForm({
  block,
}: {
  block: { id: string; name: string };
}) {
  const [updateState, updateAction] = useActionState(updateBlockMeta, initialState);
  const [deleteState, deleteAction] = useActionState(deleteBlock, initialState);

  return (
    <div className="space-y-4">
      <form action={updateAction} className="space-y-4">
        <input type="hidden" name="id" value={block.id} />
        <Alert message={updateState.error} variant="error" />
        <Alert message={updateState.success} variant="success" />

        <FormInput
          label="블록 이름"
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={block.name}
        />

        <div className="flex justify-end">
          <SubmitButton pendingText="저장 중...">저장</SubmitButton>
        </div>
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={block.id} />
        <Alert message={deleteState.error} variant="error" />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            className="text-red-500 ring-red-400/40 hover:bg-red-500/10 dark:text-red-300"
          >
            블록 삭제
          </Button>
        </div>
      </form>
    </div>
  );
}
