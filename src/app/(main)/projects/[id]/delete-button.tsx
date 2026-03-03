"use client";

import { useState, useActionState } from "react";
import { deleteProject } from "../actions";
import { Button, Dialog, Alert } from "@/components";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function DeleteButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteProject, initialState);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        삭제
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-gray-800/70">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-gray-300" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-base/7 font-semibold text-gray-900 dark:text-gray-100">
              프로젝트 삭제
            </h3>
            <div className="mt-2">
              <p className="text-sm/6 text-gray-500 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">
                  {projectName}
                </strong>{" "}
                프로젝트를 삭제하시겠습니까? 삭제된 프로젝트는 복구할 수
                있습니다.
              </p>
            </div>
            <Alert message={state.error} variant="error" />
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <form action={formAction}>
            <input type="hidden" name="id" value={projectId} />
            <Button type="submit" className="w-full sm:ml-3 sm:w-auto bg-red-600 hover:bg-red-500 dark:bg-gray-700 dark:hover:bg-gray-600">
              삭제
            </Button>
          </form>
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            className="mt-3 sm:mt-0"
          >
            취소
          </Button>
        </div>
      </Dialog>
    </>
  );
}
