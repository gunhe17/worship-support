"use client";

import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";

interface DropdownItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  /** Flat array = single section, nested arrays = divided sections */
  items: DropdownItem[] | DropdownItem[][];
  align?: "left" | "right";
}

function isGrouped(items: DropdownItem[] | DropdownItem[][]): items is DropdownItem[][] {
  return items.length > 0 && Array.isArray(items[0]);
}

function DropdownItemRow({ item }: { item: DropdownItem }) {
  const className =
    "block w-full px-4 py-2 text-left text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-hidden dark:text-gray-300 dark:data-[focus]:bg-gray-800/70 dark:data-[focus]:text-gray-100";

  return (
    <MenuItem>
      {item.href ? (
        <a href={item.href} className={className}>
          {item.label}
        </a>
      ) : (
        <button type="button" onClick={item.onClick} className={className}>
          {item.label}
        </button>
      )}
    </MenuItem>
  );
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const anchorAlign = align === "right" ? "bottom end" : "bottom start";

  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton as="div">{trigger}</MenuButton>

      <MenuItems
        anchor={anchorAlign}
        transition
        className="z-50 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-gray-200 transition focus:outline-hidden data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[enter]:ease-out data-[leave]:duration-75 data-[leave]:ease-in dark:bg-gray-800 dark:ring-gray-700 [--anchor-gap:theme(spacing.2)]"
      >
        {isGrouped(items) ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((section, i) => (
              <div key={i} className="py-1">
                {section.map((item) => (
                  <DropdownItemRow key={item.label} item={item} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-1">
            {items.map((item) => (
              <DropdownItemRow key={item.label} item={item} />
            ))}
          </div>
        )}
      </MenuItems>
    </Menu>
  );
}
