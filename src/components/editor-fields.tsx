"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { EditorFloatingMenu, EditorIconButton } from "./editor-shell";

function readAnchorRect(el: HTMLElement | null) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.bottom + 2,
    left: rect.left,
    width: rect.width,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function NumberField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:border-white/15 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-white/5 dark:disabled:text-gray-400"
      />
    </label>
  );
}

export function InlineSelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => setMenuRect(readAnchorRect(buttonRef.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setMenuRect(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            setMenuRect(next ? readAnchorRect(buttonRef.current) : null);
            return next;
          })
        }
        className={`group flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors dark:hover:bg-white/10 ${
          open ? "bg-gray-100 dark:bg-white/15" : "hover:bg-gray-100"
        }`}
      >
        {label ? (
          <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
            {label}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-gray-700 dark:text-gray-200">
          {value}
        </span>
        <span
          className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        >
          <ChevronDownIcon className="h-3 w-3" />
        </span>
      </button>

      {open && menuRect && (
        <EditorFloatingMenu
          menuRef={menuRef}
          top={menuRect.top}
          left={menuRect.left}
          width={menuRect.width}
        >
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setMenuRect(null);
                }}
                className="block w-full rounded px-2 py-1 text-left text-[10px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
              >
                {option.label}
              </button>
            ))}
          </div>
        </EditorFloatingMenu>
      )}
    </>
  );
}

export function ColorPickerField({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [savedColors, setSavedColors] = useState<string[]>([
    "#6d67d8",
    "#22c55e",
    "#fb923c",
    "#f43f5e",
    "#facc15",
    "#14b8a6",
    "#38bdf8",
    "#94a3b8",
  ]);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6d67d8";
  const currentRgb = hexToRgb(safeHex) ?? { r: 109, g: 103, b: 216 };
  const hsv = rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b);

  useEffect(() => {
    if (!open) return;
    const update = () => setPanelRect(readAnchorRect(buttonRef.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
      setPanelRect(null);
      onCommit?.(safeHex);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, onCommit, safeHex]);

  const handleHuePointer = (clientX: number) => {
    if (!panelRef.current) return;
    const hueTrack = panelRef.current.querySelector("[data-hue-track]") as HTMLDivElement | null;
    if (!hueTrack) return;
    const rect = hueTrack.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const next = { ...hsv, h: ratio * 360 };
    const rgb = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const handleSvPointer = (clientX: number, clientY: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const next = { ...hsv, s, v };
    const rgb = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const commitNextHsv = (next: { h: number; s: number; v: number }) => {
    const normalized = {
      h: clamp(next.h, 0, 360),
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    };
    const rgb = hsvToRgb(normalized.h, normalized.s, normalized.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            setPanelRect(next ? readAnchorRect(buttonRef.current) : null);
            if (!next) onCommit?.(safeHex);
            return next;
          })
        }
        className={`group flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border px-2 transition-colors ${
          open
            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
            : "border-transparent hover:bg-gray-100 dark:hover:bg-white/10"
        }`}
      >
        <span
          className="h-4 w-4 rounded border border-gray-300 dark:border-white/20"
          style={{ backgroundColor: safeHex }}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700 dark:text-gray-200">
          {safeHex}
        </span>
        <ChevronDownIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
      </button>

      {open && panelRect && (
        <EditorFloatingMenu
          menuRef={panelRef}
          top={panelRect.top}
          left={panelRect.left}
          width={Math.max(panelRect.width, 224)}
        >
          <div className="p-2.5">
            <div
              ref={svRef}
              className="relative mb-2 h-28 w-full cursor-crosshair rounded-md"
              style={{
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                backgroundImage:
                  "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                handleSvPointer(event.clientX, event.clientY);
                const move = (moveEvent: PointerEvent) =>
                  handleSvPointer(moveEvent.clientX, moveEvent.clientY);
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                }}
              />
            </div>

            <input
              data-hue-track
              type="range"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              onChange={(e) => commitNextHsv({ ...hsv, h: Number(e.target.value) })}
              onPointerDown={() => {
                const move = (moveEvent: PointerEvent) => handleHuePointer(moveEvent.clientX);
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              className="mb-3 h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
            />

            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {(["r", "g", "b"] as const).map((key) => {
                const nextValue = key === "r" ? currentRgb.r : key === "g" ? currentRgb.g : currentRgb.b;
                return (
                  <input
                    key={key}
                    type="number"
                    min={0}
                    max={255}
                    value={nextValue}
                    onChange={(e) => {
                      const parsed = clamp(Number(e.target.value) || 0, 0, 255);
                      const nextRgb = {
                        r: key === "r" ? parsed : currentRgb.r,
                        g: key === "g" ? parsed : currentRgb.g,
                        b: key === "b" ? parsed : currentRgb.b,
                      };
                      onChange(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
                    }}
                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-indigo-300 dark:border-white/15 dark:bg-gray-900 dark:text-gray-200"
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Saved Colors</p>
              <EditorIconButton
                type="button"
                onClick={() =>
                  setSavedColors((prev) =>
                    prev.includes(safeHex) ? prev : [safeHex, ...prev].slice(0, 12)
                  )
                }
                className="text-[14px]"
                aria-label="Add color"
                tone="muted"
              >
                <PlusIcon className="h-3 w-3" />
              </EditorIconButton>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {savedColors.map((saved) => (
                <button
                  key={saved}
                  type="button"
                  onClick={() => onChange(saved)}
                  className="h-5 w-5 rounded-full border border-gray-200 dark:border-white/15"
                  style={{ backgroundColor: saved }}
                  aria-label={`Select color ${saved}`}
                />
              ))}
            </div>
          </div>
        </EditorFloatingMenu>
      )}
    </div>
  );
}
