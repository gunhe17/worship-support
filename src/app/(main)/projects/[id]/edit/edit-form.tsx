"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateProject } from "../../actions";
import {
  Card,
  CardHeader,
  CardBody,
  FormInput,
  SubmitButton,
  Alert,
} from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function EditProjectForm({
  project,
}: {
  project: { id: string; name: string };
}) {
  const [state, formAction] = useActionState(updateProject, initialState);

  return (
    <Card className="border-white/10 bg-gray-900/70">
      <CardHeader
        title="프로젝트 수정"
        description="프로젝트 정보를 수정합니다."
      />
      <CardBody>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="id" value={project.id} />
          <Alert message={state.error} variant="error" />
          <Alert message={state.success} variant="success" />
          <FormInput
            label="프로젝트 이름"
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={project.name}
          />
          <div className="flex items-center justify-end gap-x-3">
            <Link
              href={`/project/${project.id}`}
              className="text-sm/6 font-semibold text-gray-400 hover:text-gray-300"
            >
              취소
            </Link>
            <SubmitButton pendingText="저장 중...">저장</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
