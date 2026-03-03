"use client";

import { useActionState } from "react";
import {
  addAdvertisementItem,
  removeAdvertisementItem,
  reorderAdvertisementItem,
} from "../actions";
import { Alert, FormSelect } from "@/components";
import type { FormState } from "@/lib/form-types";

const initialState: FormState = { error: null, success: null };

export function AdvertisementItemsPanel({
  parentBlockId,
  blocks,
  items,
}: {
  parentBlockId: string;
  blocks: Array<{ id: string; name: string }>;
  items: Array<{ id: string; sequence: number; childBlockId: string; childName: string }>;
}) {
  const [addState, addAction] = useActionState(addAdvertisementItem, initialState);
  const [removeState, removeAction] = useActionState(removeAdvertisementItem, initialState);
  const [reorderState, reorderAction] = useActionState(reorderAdvertisementItem, initialState);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Alert message={addState.error} variant="error" />
        <Alert message={addState.success} variant="success" />
        <form action={addAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="parentBlockId" value={parentBlockId} />
          <div className="w-full">
            <FormSelect
              label="추가할 블록"
              id="childBlockId"
              name="childBlockId"
              options={blocks.map((block) => ({ value: block.id, label: block.name }))}
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
          >
            추가
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <Alert message={reorderState.error} variant="error" />
        <Alert message={reorderState.success} variant="success" />
        <Alert message={removeState.error} variant="error" />
        <Alert message={removeState.success} variant="success" />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr className="text-left text-sm font-semibold text-gray-100">
                <th className="px-6 py-4">순서</th>
                <th className="px-6 py-4">블록</th>
                <th className="px-6 py-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-gray-100">{item.childName}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <form action={reorderAction}>
                        <input type="hidden" name="parentBlockId" value={parentBlockId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={index === 0}
                          className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={reorderAction}>
                        <input type="hidden" name="parentBlockId" value={parentBlockId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === items.length - 1}
                          className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </form>
                      <form action={removeAction}>
                        <input type="hidden" name="parentBlockId" value={parentBlockId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
