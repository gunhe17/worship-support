"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Alert, Dialog, FormInput, Toast } from "@/components";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { FormState } from "@/lib/form-types";
import { createProject } from "./actions";

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

export function CreateProjectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createProject, initialState);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const toastOpen = Boolean(state.success && state.success !== dismissedSuccessMessage);
  const dialogOpen = open && (!state.success || state.success === dismissedSuccessMessage);

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
        onClick={() => {
          setDismissedSuccessMessage(state.success);
          setOpen(true);
        }}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        추가하기
      </button>

      <Dialog open={dialogOpen} onClose={() => setOpen(false)}>
        <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          프로젝트 추가
        </h3>
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
          <Alert message={state.error} variant="error" />
          <FormInput
            label="프로젝트 이름"
            id="project-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="예배 프로젝트"
          />

          <div className="flex items-center justify-end pt-1">
            <ModalSubmitButton />
          </div>
        </form>
      </Dialog>
    </>
  );
}
