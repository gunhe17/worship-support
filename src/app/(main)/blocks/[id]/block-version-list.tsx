"use client";

import { useActionState } from "react";
import { setBlockCurrentVersion } from "../actions";
import { Alert } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function BlockVersionList({
  blockId,
  currentVersionId,
  versions,
}: {
  blockId: string;
  currentVersionId: string | null;
  versions: Array<{ id: string; created_at: string }>;
}) {
  const [state, formAction] = useActionState(setBlockCurrentVersion, initialState);

  return (
    <div className="space-y-4">
      <Alert message={state.error} variant="error" />
      <Alert message={state.success} variant="success" />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr className="text-left text-sm font-semibold text-gray-100">
              <th className="px-6 py-4">버전 ID</th>
              <th className="px-6 py-4">생성일</th>
              <th className="px-6 py-4 text-right">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-sm">
            {versions.map((version) => {
              const isCurrent = currentVersionId === version.id;

              return (
                <tr key={version.id}>
                  <td className="px-6 py-4 text-gray-200">{version.id}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(version.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isCurrent ? (
                      <span className="font-semibold text-emerald-400">현재</span>
                    ) : (
                      <form action={formAction}>
                        <input type="hidden" name="id" value={blockId} />
                        <input type="hidden" name="versionId" value={version.id} />
                        <button
                          type="submit"
                          className="font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          현재로 설정
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
