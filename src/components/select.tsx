"use client";

import Image from "next/image";
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";

interface SelectOption {
  value: string;
  label: string;
  avatar?: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SelectAvatar({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={20}
      height={20}
      unoptimized
      className="size-5 shrink-0 rounded-full"
    />
  );
}

export function Select({ label, options, value, onChange, placeholder = "선택하세요" }: SelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      {label && (
        <Listbox value={value} onChange={onChange}>
          <Listbox.Label className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
            {label}
          </Listbox.Label>
          <div className="relative mt-2">
            <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:focus-visible:outline-gray-400 sm:text-sm/6">
              <span className="col-start-1 row-start-1 flex items-center gap-3 pr-6">
                {selected?.avatar && (
                  <SelectAvatar src={selected.avatar} />
                )}
                <span className="block truncate">{selected?.label ?? placeholder}</span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 dark:text-gray-400 sm:size-4"
              />
            </ListboxButton>

            <ListboxOptions
              transition
              className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-200 focus:outline-hidden data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in dark:bg-gray-800 dark:ring-gray-700 sm:text-sm"
            >
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className="group relative cursor-default select-none py-2 pr-9 pl-3 text-gray-900 data-[focus]:bg-indigo-600 data-[focus]:text-white data-[focus]:outline-hidden dark:text-gray-100 dark:data-[focus]:bg-gray-700"
                >
                  <div className="flex items-center">
                    {option.avatar && (
                      <SelectAvatar src={option.avatar} />
                    )}
                    <span className={`${option.avatar ? "ml-3" : ""} block truncate font-normal group-data-[selected]:font-semibold`}>
                      {option.label}
                    </span>
                  </div>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white dark:text-gray-300">
                    <CheckIcon aria-hidden="true" className="size-5" />
                  </span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      )}
      {!label && (
        <Listbox value={value} onChange={onChange}>
          <div className="relative">
            <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:focus-visible:outline-gray-400 sm:text-sm/6">
              <span className="col-start-1 row-start-1 flex items-center gap-3 pr-6">
                {selected?.avatar && (
                  <SelectAvatar src={selected.avatar} />
                )}
                <span className="block truncate">{selected?.label ?? placeholder}</span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 dark:text-gray-400 sm:size-4"
              />
            </ListboxButton>

            <ListboxOptions
              transition
              className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-200 focus:outline-hidden data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in dark:bg-gray-800 dark:ring-gray-700 sm:text-sm"
            >
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className="group relative cursor-default select-none py-2 pr-9 pl-3 text-gray-900 data-[focus]:bg-indigo-600 data-[focus]:text-white data-[focus]:outline-hidden dark:text-gray-100 dark:data-[focus]:bg-gray-700"
                >
                  <div className="flex items-center">
                    {option.avatar && (
                      <SelectAvatar src={option.avatar} />
                    )}
                    <span className={`${option.avatar ? "ml-3" : ""} block truncate font-normal group-data-[selected]:font-semibold`}>
                      {option.label}
                    </span>
                  </div>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white dark:text-gray-300">
                    <CheckIcon aria-hidden="true" className="size-5" />
                  </span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      )}
    </div>
  );
}
