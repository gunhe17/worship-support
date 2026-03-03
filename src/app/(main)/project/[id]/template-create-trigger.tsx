"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Cross2Icon, PlusIcon } from "@radix-ui/react-icons";
import { Alert, Dialog, FormInput, FormSelect, Toast } from "@/components";
import type { FormState } from "@/lib/form-types";
import { createTemplateInProject } from "./actions";

const initialState: FormState = { error: null, success: null };

function ModalSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-20 items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "추가 중..." : "추가하기"}
    </button>
  );
}

export function TemplateCreateTrigger({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createTemplateInProject, initialState);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const toastOpen = Boolean(state.success && state.success !== dismissedSuccessMessage);

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [router, state.success]);

  return (
    <>
      <Toast
        open={toastOpen}
        message={state.success}
        onClose={() => setDismissedSuccessMessage(state.success)}
        variant="success"
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="템플릿 추가"
        className="inline-flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
      >
        <PlusIcon className="size-4" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">템플릿 추가</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="모달 닫기"
            className="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800/60 dark:hover:text-gray-300"
          >
            <Cross2Icon className="size-4" />
          </button>
        </div>

        <form
          action={formAction}
          className="mt-5 space-y-4"
          onSubmit={() => setDismissedSuccessMessage(null)}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <Alert message={state.error} variant="error" />

          <FormInput
            label="템플릿 이름"
            id="template-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="주일예배 순서"
          />

          <FormSelect
            label="타입"
            id="template-type"
            name="type"
            options={[
              { value: "card-news", label: "card-news" },
              { value: "presentation", label: "presentation" },
            ]}
          />

          <div className="flex items-center justify-end pt-1">
            <ModalSubmitButton />
          </div>
        </form>
      </Dialog>
    </>
  );
}
