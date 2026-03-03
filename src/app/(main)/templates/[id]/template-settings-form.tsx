"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate, updateTemplate } from "../actions";
import {
  Alert,
  Button,
  FormInput,
  FormSelect,
  SubmitButton,
  Toast,
} from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function TemplateSettingsForm({
  template,
}: {
  template: {
    id: string;
    projectId: string;
    name: string;
    type: "card-news" | "presentation";
  };
}) {
  const router = useRouter();
  const [updateState, updateAction] = useActionState(updateTemplate, initialState);
  const [deleteState, deleteAction] = useActionState(deleteTemplate, initialState);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const toastOpen = Boolean(
    updateState.success && updateState.success !== dismissedSuccessMessage
  );

  useEffect(() => {
    if (!updateState.success) return;
    router.refresh();
  }, [router, updateState.success]);

  return (
    <div className="space-y-4">
      <Toast
        open={toastOpen}
        message={updateState.success}
        onClose={() => setDismissedSuccessMessage(updateState.success)}
        variant="success"
      />

      <form
        action={updateAction}
        className="space-y-4"
        onSubmit={() => setDismissedSuccessMessage(null)}
      >
        <input type="hidden" name="id" value={template.id} />
        <Alert message={updateState.error} variant="error" />

        <FormInput
          label="템플릿 이름"
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={template.name}
        />

        <FormSelect
          label="타입"
          id="type"
          name="type"
          defaultValue={template.type}
          options={[
            { value: "card-news", label: "card-news" },
            { value: "presentation", label: "presentation" },
          ]}
        />

        <div className="flex justify-end">
          <SubmitButton pendingText="저장 중...">저장</SubmitButton>
        </div>
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={template.id} />
        <Alert message={deleteState.error} variant="error" />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            className="text-red-500 ring-red-400/40 hover:bg-red-500/10 dark:text-red-300"
          >
            템플릿 삭제
          </Button>
        </div>
      </form>
    </div>
  );
}
