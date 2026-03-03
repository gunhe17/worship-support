"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Alert, Dialog, FormInput, Toast } from "@/components";
import { Cross2Icon, Pencil2Icon } from "@radix-ui/react-icons";
import type { FormState } from "@/lib/form-types";
import { updateProject } from "../actions";

const initialState: FormState = { error: null, success: null };

function ModalSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-20 items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "저장 중..." : "저장"}
    </button>
  );
}

export function ProjectEditForm({
  project,
}: {
  project: { id: string; name: string; createdAt: string; updatedAt: string };
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateProject, initialState);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
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
      <div className="px-6 py-6">
        <div>
          <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base/7 font-semibold text-gray-900 dark:text-gray-100">
                Project Information
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDraftName(project.name);
                  setOpen(true);
                }}
                aria-label="프로젝트 수정"
                className="inline-flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
              >
                <Pencil2Icon className="size-4" />
              </button>
            </div>
            <p className="mt-1 max-w-2xl text-sm/6 text-gray-500 dark:text-gray-400">
              Project details and settings.
            </p>
          </div>

          <div className="mt-6 border-t border-gray-200 dark:border-gray-700">
            <dl className="divide-y divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">Project ID</dt>
                <dd className="mt-1 text-sm/6 text-gray-600 sm:col-span-2 sm:mt-0 dark:text-gray-300">
                  {project.id}
                </dd>
              </div>

              <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">Name</dt>
                <dd className="mt-1 sm:col-span-2 sm:mt-0">
                  <p className="text-sm/6 text-gray-600 dark:text-gray-300">{project.name}</p>
                </dd>
              </div>

              <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">Created</dt>
                <dd className="mt-1 text-sm/6 text-gray-600 sm:col-span-2 sm:mt-0 dark:text-gray-300">
                  {new Date(project.createdAt).toLocaleDateString("ko-KR")}
                </dd>
              </div>

              <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">Updated</dt>
                <dd className="mt-1 text-sm/6 text-gray-600 sm:col-span-2 sm:mt-0 dark:text-gray-300">
                  {new Date(project.updatedAt).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">프로젝트 수정</h3>
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
          <input type="hidden" name="id" value={project.id} />
          <Alert message={state.error} variant="error" />
          <div>
            <label
              htmlFor="project-id"
              className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100"
            >
              프로젝트 ID (읽기 전용)
            </label>
            <input
              id="project-id"
              type="text"
              value={project.id}
              readOnly
              className="block h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            />
          </div>
          <FormInput
            label="프로젝트 이름"
            id="project-name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="예배 프로젝트"
          />
          <div>
            <label
              htmlFor="project-created-at"
              className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100"
            >
              생성일 (읽기 전용)
            </label>
            <input
              id="project-created-at"
              type="text"
              value={new Date(project.createdAt).toLocaleDateString("ko-KR")}
              readOnly
              className="block h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            />
          </div>
          <div>
            <label
              htmlFor="project-updated-at"
              className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100"
            >
              수정일 (읽기 전용)
            </label>
            <input
              id="project-updated-at"
              type="text"
              value={new Date(project.updatedAt).toLocaleDateString("ko-KR")}
              readOnly
              className="block h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            />
          </div>
          <div className="flex items-center justify-end pt-1">
            <ModalSubmitButton />
          </div>
        </form>
      </Dialog>
    </>
  );
}
