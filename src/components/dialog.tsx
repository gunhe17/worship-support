"use client";

import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in dark:bg-gray-900/75"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-2xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:trangray-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:trangray-y-0 data-[closed]:sm:scale-95 dark:bg-gray-800"
          >
            {children}
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  );
}

export function SlideOver({ open, onClose, children }: DialogProps) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in dark:bg-gray-900/75"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <DialogPanel
              transition
              className="pointer-events-auto w-screen max-w-md transform transition duration-300 ease-in-out data-[closed]:trangray-x-full"
            >
              <div className="flex h-full flex-col overflow-y-auto bg-white p-6 shadow-xl dark:bg-gray-900">
                {children}
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </HeadlessDialog>
  );
}
