"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  Cross1Icon,
  FileTextIcon,
  HamburgerMenuIcon,
  MinusIcon,
  PlusIcon,
} from "@radix-ui/react-icons";

type BlockType = string;
type CreateFieldConfig = {
  key: string;
  label: string;
  inputType?: "text" | "datetime-local";
};

export type EditorTemplate = {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  updatedAt?: string;
};

export type EditorBlock = {
  id: string;
  name: string;
  type: BlockType;
  currentVersionId: string | null;
  currentVersionData: Record<string, string> | null;
  updatedAt: string;
};

export type RenderNode = {
  id: string;
  blockId: string;
  label: string;
  type: BlockType;
  location: { x: number; y: number; z: number };
  size: { width: number; height: number } | null;
  updatedAt: string;
};

export type EditorInitialData = {
  project: {
    id: string;
    name: string;
  };
  templates: EditorTemplate[];
  blocks: EditorBlock[];
  nodes: RenderNode[];
  selectedTemplateId: string | null;
};

const sizePresets = [
  { label: "1920 x 1080 (16:9)", width: 1920, height: 1080 },
  { label: "1280 x 720 (16:9)", width: 1280, height: 720 },
  { label: "1080 x 1080 (1:1)", width: 1080, height: 1080 },
  { label: "1080 x 1350 (4:5)", width: 1080, height: 1350 },
  { label: "1080 x 1920 (9:16)", width: 1080, height: 1920 },
];

const templateTypeOptions = [
  { value: "presentation", label: "presentation" },
  { value: "card-news", label: "card-news" },
];

const editableVersionFieldsByType: Record<string, string[]> = {
  txt: ["title", "description", "content"],
  image: ["title", "description", "image_path", "crop"],
  datetime: ["title", "description", "start_at", "end_at"],
  song: ["title", "description", "reference_url", "musical_key"],
  song_list: ["title", "description", "reference_url"],
  advertisement: ["title", "description"],
  background: ["mode", "image_path", "color"],
};

const createFieldConfigByType: Record<string, CreateFieldConfig[]> = {
  txt: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "content", label: "content" },
  ],
  image: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "image_path", label: "image_path" },
    { key: "crop", label: "crop(json)" },
  ],
  datetime: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "start_at", label: "start_at", inputType: "datetime-local" },
    { key: "end_at", label: "end_at", inputType: "datetime-local" },
  ],
  song: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "reference_url", label: "reference_url" },
    { key: "musical_key", label: "musical_key" },
  ],
  song_list: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "reference_url", label: "reference_url" },
  ],
  advertisement: [
    { key: "title", label: "title" },
    { key: "description", label: "description" },
  ],
  background: [
    { key: "mode", label: "mode" },
    { key: "image_path", label: "image_path" },
    { key: "color", label: "color" },
  ],
};

const requiredFieldKeysByType: Record<string, string[]> = {
  txt: ["title", "content"],
  image: ["title", "image_path"],
  datetime: ["title", "start_at"],
  song: ["title"],
  song_list: ["title"],
  advertisement: ["title", "description"],
  background: ["mode"],
};

function clampMin1(value: number) {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function formatShortId(value: string) {
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function NumberField({
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

function readAnchorRect(el: HTMLElement | null) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.bottom + 2,
    left: rect.left,
    width: rect.width,
  };
}

function InlineSelectRow({
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
        <div
          ref={menuRef}
          className="fixed z-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-gray-900"
          style={{
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
          }}
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
        </div>
      )}
    </>
  );
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

function ColorPickerField({
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
  const [hsv, setHsv] = useState(() => rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b));

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
  }, [onCommit, open, safeHex]);

  function commitNextHsv(next: { h: number; s: number; v: number }) {
    setHsv(next);
    const rgb = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  }

  function updateSaturationValue(clientX: number, clientY: number) {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    commitNextHsv({ ...hsv, s, v });
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setHsv(rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b));
              setPanelRect(readAnchorRect(buttonRef.current));
            } else {
              setPanelRect(null);
            }
            return next;
          })
        }
        className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10"
      >
        <span
          className="h-4 w-4 rounded border border-gray-300 dark:border-white/15"
          style={{ backgroundColor: safeHex }}
        />
        <span className="text-[11px] text-gray-700 dark:text-gray-200">{safeHex.toUpperCase()}</span>
      </button>

      {open && panelRect && (
        <div
          ref={panelRef}
          className="fixed z-50 w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-gray-900"
          style={{
            top: panelRect.top,
            // Align with the field row start (label + gap width offset).
            left: Math.max(8, panelRect.left - 60),
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Color Picker</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCommit?.(safeHex);
              }}
              className="h-6 w-6 rounded text-base leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
            >
              <Cross1Icon className="mx-auto h-3.5 w-3.5" />
            </button>
          </div>

          <div
            ref={svRef}
            onPointerDown={(e) => {
              updateSaturationValue(e.clientX, e.clientY);
              const move = (me: PointerEvent) => updateSaturationValue(me.clientX, me.clientY);
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            className="relative mb-3 h-40 w-full cursor-crosshair rounded-lg"
            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
          >
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent" />
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(e) => commitNextHsv({ ...hsv, h: Number(e.target.value) })}
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
            <button
              type="button"
              onClick={() =>
                setSavedColors((prev) =>
                  prev.includes(safeHex) ? prev : [safeHex, ...prev].slice(0, 12)
                )
              }
              className="inline-flex h-5 w-5 items-center justify-center rounded text-[14px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              aria-label="Add color"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
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
      )}
    </div>
  );
}

export function TemplateEditor({
  initialData,
}: {
  initialData: EditorInitialData;
}) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(340);
  const [templateConfigs, setTemplateConfigs] = useState(initialData.templates);
  const [blocks, setBlocks] = useState(initialData.blocks);
  const [nodes, setNodes] = useState(initialData.nodes);
  const [selectedId, setSelectedId] = useState(initialData.nodes[0]?.id ?? "");
  const [openSizeMenuId, setOpenSizeMenuId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [openBlockIds, setOpenBlockIds] = useState<string[]>([]);
  const [showCreateBlockForm, setShowCreateBlockForm] = useState(false);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [createBlockError, setCreateBlockError] = useState<string | null>(null);
  const [showCreateValidation, setShowCreateValidation] = useState(false);
  const [openCreateTypeMenu, setOpenCreateTypeMenu] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockType, setNewBlockType] = useState<BlockType>("txt");
  const [newBlockFields, setNewBlockFields] = useState<Record<string, string>>({
    title: "",
    content: "",
  });
  const createFormRef = useRef<HTMLDivElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createTypeButtonRef = useRef<HTMLButtonElement>(null);
  const createTypeMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const autoCreateRequestedRef = useRef(false);
  const [sizeMenuRect, setSizeMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [createTypeMenuRect, setCreateTypeMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);
  const [sizeDrafts, setSizeDrafts] = useState<
    Record<string, { width: string; height: string }>
  >(() =>
    Object.fromEntries(
      initialData.templates.map((template) => [
        template.id,
        { width: String(template.width), height: String(template.height) },
      ])
    )
  );
  const shellRef = useRef<HTMLDivElement>(null);

  const activeTemplate =
    templateConfigs.find((template) => template.id === initialData.selectedTemplateId) ??
    templateConfigs[0] ??
    null;
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [blocks]
  );

  const latestRenderByBlock = useMemo(() => {
    const mapped = new Map<string, RenderNode>();

    for (const node of nodes) {
      const existing = mapped.get(node.blockId);
      if (!existing) {
        mapped.set(node.blockId, node);
        continue;
      }

      if (new Date(node.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        mapped.set(node.blockId, node);
      }
    }

    return mapped;
  }, [nodes]);

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.location.z - b.location.z),
    [nodes]
  );

  const previewFrame = useMemo(() => {
    const sourceWidth = Math.max(1, activeTemplate?.width ?? 960);
    const sourceHeight = Math.max(1, activeTemplate?.height ?? 540);
    const maxWidth = 1120;
    const maxHeight = 540;
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

    return {
      sourceWidth,
      sourceHeight,
      displayWidth: Math.round(sourceWidth * scale),
      displayHeight: Math.round(sourceHeight * scale),
      scaleX: (sourceWidth * scale) / sourceWidth,
      scaleY: (sourceHeight * scale) / sourceHeight,
    };
  }, [activeTemplate]);

  function setTemplateLocal(templateId: string, patch: Partial<EditorTemplate>) {
    setTemplateConfigs((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? {
              ...template,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : template
      )
    );
  }

  async function persistTemplate(
    templateId: string,
    patch: Partial<{ name: string; width: number; height: number; type: "presentation" | "card-news" }>
  ) {
    const { error } = await supabase.from("template").update(patch).eq("id", templateId);
    if (error) {
      console.error("Failed to update template", error);
    }
  }

  function patchTemplateNameLocal(templateId: string, name: string) {
    setTemplateLocal(templateId, { name });
  }

  function patchTemplateTypeLocal(templateId: string, type: string) {
    setTemplateLocal(templateId, { type });
  }

  async function saveTemplateName(templateId: string, name: string) {
    await persistTemplate(templateId, { name });
  }

  async function saveTemplateType(templateId: string, type: string) {
    await persistTemplate(templateId, { type: type as "presentation" | "card-news" });
  }

  function patchSizeDraft(
    templateId: string,
    key: "width" | "height",
    value: string
  ) {
    setSizeDrafts((prev) => ({
      ...prev,
      [templateId]: {
        width: prev[templateId]?.width ?? "",
        height: prev[templateId]?.height ?? "",
        [key]: value,
      },
    }));
  }

  async function applyTemplateSize(templateId: string, width: number, height: number) {
    const nextWidth = clampMin1(width);
    const nextHeight = clampMin1(height);

    setTemplateLocal(templateId, {
      width: nextWidth,
      height: nextHeight,
    });

    setSizeDrafts((prev) => ({
      ...prev,
      [templateId]: {
        width: String(nextWidth),
        height: String(nextHeight),
      },
    }));

    await persistTemplate(templateId, {
      width: nextWidth,
      height: nextHeight,
    });
  }

  function touchBlockLocal(blockId: string, patch: Partial<EditorBlock>) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : block
      )
    );
  }

  const createBlockVersion = useCallback(async (
    blockId: string,
    type: string,
    initialValues?: Record<string, string>
  ): Promise<{ id: string; values: Record<string, string> } | null> => {
    const values = initialValues ?? {};

    if (type === "txt") {
      const title = values.title ?? "";
      const content = values.content ?? "";
      const description = values.description ?? "";
      const { data, error } = await supabase
        .from("block_txt")
        .insert({ block_id: blockId, title, description, content })
        .select("id, title, description, content")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          content: data.content ?? "",
        },
      };
    }

    if (type === "image") {
      const title = values.title ?? "";
      const imagePath = values.image_path ?? "";
      const description = values.description ?? "";
      let crop: unknown = null;
      if ((values.crop ?? "").trim()) {
        try {
          crop = JSON.parse(values.crop);
        } catch {
          crop = null;
        }
      }
      const { data, error } = await supabase
        .from("block_image")
        .insert({ block_id: blockId, title, description, image_path: imagePath, crop })
        .select("id, title, description, image_path, crop")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          image_path: data.image_path ?? "",
          crop: data.crop ? JSON.stringify(data.crop) : "",
        },
      };
    }

    if (type === "datetime") {
      const title = values.title ?? "";
      const description = values.description ?? "";
      const startAt = values.start_at || new Date().toISOString();
      const endAt = values.end_at?.trim() ? values.end_at : null;
      const { data, error } = await supabase
        .from("block_datetime")
        .insert({
          block_id: blockId,
          title,
          description,
          start_at: startAt,
          end_at: endAt,
        })
        .select("id, title, description, start_at, end_at")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          start_at: data.start_at ?? "",
          end_at: data.end_at ?? "",
        },
      };
    }

    if (type === "song") {
      const title = values.title ?? "";
      const description = values.description ?? "";
      const referenceUrl = values.reference_url ?? "";
      const musicalKey = values.musical_key ?? "";
      const { data, error } = await supabase
        .from("block_song")
        .insert({
          block_id: blockId,
          title,
          description,
          reference_url: referenceUrl,
          musical_key: musicalKey,
        })
        .select("id, title, description, reference_url, musical_key")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          reference_url: data.reference_url ?? "",
          musical_key: data.musical_key ?? "",
        },
      };
    }

    if (type === "song_list") {
      const title = values.title ?? "";
      const description = values.description ?? "";
      const referenceUrl = values.reference_url ?? "";
      const { data, error } = await supabase
        .from("block_song_list")
        .insert({
          block_id: blockId,
          title,
          description,
          reference_url: referenceUrl,
        })
        .select("id, title, description, reference_url")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          reference_url: data.reference_url ?? "",
        },
      };
    }

    if (type === "advertisement") {
      const title = values.title ?? "";
      const description = values.description ?? "";
      const { data, error } = await supabase
        .from("block_advertisement")
        .insert({ block_id: blockId, title, description })
        .select("id, title, description")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
        },
      };
    }

    if (type === "background") {
      const modeRaw = (values.mode ?? "").trim();
      const mode: "color" | "image" = modeRaw === "image" ? "image" : "color";
      const imagePathRaw = values.image_path ?? "";
      const colorRaw = values.color ?? "";
      const imagePath = mode === "image" && imagePathRaw.trim() ? imagePathRaw.trim() : null;
      const color = mode === "color" && colorRaw.trim() ? colorRaw.trim() : null;
      const { data, error } = await supabase
        .from("block_background")
        .insert({ block_id: blockId, mode, image_path: imagePath, color })
        .select("id, mode, image_path, color")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          mode: data.mode ?? "",
          image_path: data.image_path ?? "",
          color: data.color ?? "",
        },
      };
    }

    return null;
  }, [supabase]);

  function patchBlockCurrentVersionFieldLocal(
    blockId: string,
    field: string,
    value: string
  ) {
    touchBlockLocal(blockId, {});
    setBlocks((prev) =>
      prev.map((block) =>
        block.id !== blockId
          ? block
          : {
              ...block,
              currentVersionData: {
                ...(block.currentVersionData ?? {}),
                [field]: value,
              },
            }
      )
    );
  }

  async function saveBlockCurrentVersionField(
    block: EditorBlock,
    field: string,
    value: string
  ) {
    if (!block.currentVersionId) {
      return;
    }

    const tableByType: Record<string, string> = {
      txt: "block_txt",
      image: "block_image",
      datetime: "block_datetime",
      song: "block_song",
      song_list: "block_song_list",
      advertisement: "block_advertisement",
      background: "block_background",
    };

    const table = tableByType[block.type];
    if (!table) {
      return;
    }

    let payload: Record<string, unknown> = { [field]: value };
    if (field === "crop") {
      if (!value.trim()) {
        payload = { [field]: null };
      } else {
        try {
          payload = { [field]: JSON.parse(value) };
        } catch {
          return;
        }
      }
    }
    if (block.type === "background") {
      if (field === "mode") {
        // mode only is not persisted immediately.
        // Required value(field) save will persist mode + value together.
        return;
      }
      if (field === "image_path" || field === "color") {
        const trimmed = value.trim() ? value.trim() : null;
        const mode = block.currentVersionData?.mode === "image" ? "image" : "color";

        if (field === "image_path" && mode === "image") {
          if (!trimmed) return;
          payload = {
            mode: "image",
            image_path: trimmed,
            color: null,
          };
        } else if (field === "color" && mode === "color") {
          if (!trimmed) return;
          payload = {
            mode: "color",
            color: trimmed,
            image_path: null,
          };
        } else {
          payload = { [field]: trimmed };
        }
      }
    }

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", block.currentVersionId);

    if (error) {
      console.error("Failed to update block current version field", error);
    }
  }

  const createBlock = useCallback(async (normalizedValues: Record<string, string>) => {
    if (!initialData.project.id) {
      return;
    }

    setCreateBlockError(null);
    setCreatingBlock(true);

    const createdAt = new Date().toISOString();
    const trimmedName = newBlockName.trim();
    const tempVersionId = crypto.randomUUID();
    const { data, error } = await supabase
      .from("block")
      .insert({
        project_id: initialData.project.id,
        type: newBlockType,
        name: trimmedName,
        current_version_id: tempVersionId,
      })
      .select("id, name, type, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to create block", error);
      if ((error as { code?: string } | null)?.code === "23505") {
        setCreateBlockError("동일한 이름의 block이 이미 존재합니다.");
      } else {
        setCreateBlockError("block 생성에 실패했습니다.");
      }
      setCreatingBlock(false);
      return;
    }

    const version = await createBlockVersion(data.id, newBlockType, normalizedValues);
    if (!version?.id) {
      console.error("Failed to create block version");
      await supabase
        .from("block")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", data.id);
      setCreateBlockError("version 생성에 실패했습니다.");
      setCreatingBlock(false);
      return;
    }

    const { error: linkError } = await supabase
      .from("block")
      .update({ current_version_id: version.id })
      .eq("id", data.id);
    if (linkError) {
      console.error("Failed to link current version", linkError);
      setCreateBlockError("current_version 연결에 실패했습니다.");
      setCreatingBlock(false);
      return;
    }

    setBlocks((prev) => [
      {
        id: data.id,
        name: data.name,
        type: data.type,
        currentVersionId: version.id,
        currentVersionData: version.values,
        updatedAt: data.updated_at ?? createdAt,
      },
      ...prev,
    ]);

    setOpenBlockIds((prev) => [data.id, ...prev]);
    setShowCreateBlockForm(false);
    setShowCreateValidation(false);
    setOpenCreateTypeMenu(false);
    setCreateTypeMenuRect(null);
    setNewBlockName("");
    setNewBlockType("txt");
    setNewBlockFields({ title: "", content: "" });
    autoCreateRequestedRef.current = false;
    setCreatingBlock(false);
  }, [createBlockVersion, initialData.project.id, newBlockName, newBlockType, supabase]);
  async function addNodeFromBlock(blockId: string) {
    if (!activeTemplate) {
      return;
    }

    const existing = nodes.find((node) => node.blockId === blockId);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }

    const block = blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }

    const defaultSize =
      block.type === "background"
        ? null
        : { width: 320, height: 96 };

    const location = {
      x: block.type === "background" ? 0 : 120,
      y: block.type === "background" ? 0 : 120,
      z: nodes.length,
    };

    const { data, error } = await supabase
      .from("render")
      .insert({
        template_id: activeTemplate.id,
        block_id: block.id,
        location,
        size: defaultSize,
      })
      .select("id, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to create render", error);
      return;
    }

    const nextNode: RenderNode = {
      id: data.id,
      blockId: block.id,
      label: block.name,
      type: block.type,
      location,
      size: defaultSize,
      updatedAt: data.updated_at,
    };

    setNodes((prev) => [...prev, nextNode]);
    setSelectedId(nextNode.id);
    touchBlockLocal(block.id, {});
  }

  async function persistRender(node: RenderNode) {
    const { error } = await supabase
      .from("render")
      .update({
        location: node.location,
        size: node.size,
      })
      .eq("id", node.id);

    if (error) {
      console.error("Failed to update render", error);
    }
  }

  function patchSelected(updater: (node: RenderNode) => RenderNode) {
    const target = nodes.find((node) => node.id === selectedId);
    if (!target) {
      return;
    }

    const now = new Date().toISOString();
    const patched: RenderNode = { ...updater(target), updatedAt: now };

    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== selectedId) {
          return node;
        }

        return patched;
      })
    );

    void persistRender(patched);
    touchBlockLocal(patched.blockId, {});
  }

  const selectedRenderWidth =
    selectedNode?.type === "background"
      ? (activeTemplate?.width ?? 0)
      : (selectedNode?.size?.width ?? 0);
  const selectedRenderHeight =
    selectedNode?.type === "background"
      ? (activeTemplate?.height ?? 0)
      : (selectedNode?.size?.height ?? 0);

  async function removeSelected() {
    if (!selectedNode) {
      return;
    }

    const removedId = selectedNode.id;
    const fallbackId = nodes.filter((node) => node.id !== removedId).at(-1)?.id ?? "";

    setNodes((prev) => prev.filter((node) => node.id !== removedId));
    setSelectedId(fallbackId);

    const { error } = await supabase
      .from("render")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", removedId);

    if (error) {
      console.error("Failed to remove render", error);
    }
  }

  function startResize(which: "left" | "right", startX: number) {
    const initialLeft = leftWidth;
    const initialRight = rightWidth;

    function onMove(e: PointerEvent) {
      const dx = e.clientX - startX;
      const shellWidth = shellRef.current?.clientWidth ?? 0;
      if (!shellWidth) {
        return;
      }

      const minPanel = 240;
      const minCenter = 720;
      const maxLeft = Math.max(minPanel, shellWidth - minCenter - rightWidth);
      const maxRight = Math.max(minPanel, shellWidth - minCenter - leftWidth);

      if (which === "left") {
        const next = Math.min(maxLeft, Math.max(minPanel, initialLeft + dx));
        setLeftWidth(next);
        return;
      }

      const next = Math.min(maxRight, Math.max(minPanel, initialRight - dx));
      setRightWidth(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function copyTemplateId(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTemplateId(value);
      window.setTimeout(() => {
        setCopiedTemplateId((prev) => (prev === value ? null : prev));
      }, 1200);
    } catch (error) {
      console.error("Failed to copy template id", error);
    }
  }

  function resetCreateBlockDraft(type: string) {
    const fields = createFieldConfigByType[type] ?? [];
    const nextDraft: Record<string, string> = {};
    for (const field of fields) {
      if (type === "background" && field.key === "mode") {
        nextDraft[field.key] = "color";
        continue;
      }
      nextDraft[field.key] = "";
    }
    setNewBlockFields(nextDraft);
  }

  const createValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    const normalized: Record<string, string> = {};
    const allFields = createFieldConfigByType[newBlockType] ?? [];
    const requiredSet = new Set(requiredFieldKeysByType[newBlockType] ?? []);
    const trimmedName = newBlockName.trim();

    if (!trimmedName) {
      errors.name = "required";
    } else {
      const hasDuplicateName = blocks.some(
        (block) => block.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (hasDuplicateName) {
        errors.name = "duplicate";
      }
    }

    for (const field of allFields) {
      const raw = newBlockFields[field.key] ?? "";
      normalized[field.key] = raw;

      if (field.key === "start_at" || field.key === "end_at") {
        if (!raw.trim()) {
          if (requiredSet.has(field.key)) {
            errors[field.key] = "required";
          }
          continue;
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          errors[field.key] = "invalid";
        } else {
          normalized[field.key] = parsed.toISOString();
        }
        continue;
      }

      if (field.key === "crop") {
        if (!raw.trim()) continue;
        try {
          JSON.parse(raw);
          normalized[field.key] = raw;
        } catch {
          errors[field.key] = "invalid";
        }
        continue;
      }

      if (field.key === "color") {
        if (!raw.trim()) continue;
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.trim())) {
          errors[field.key] = "invalid";
        } else {
          normalized[field.key] = raw.trim();
        }
        continue;
      }

      if (requiredSet.has(field.key) && !raw.trim()) {
        errors[field.key] = "required";
      } else if (raw.trim()) {
        normalized[field.key] = raw.trim();
      }
    }

    if (newBlockType === "background") {
      const mode = (newBlockFields.mode ?? "").trim();
      const imagePath = (newBlockFields.image_path ?? "").trim();
      const color = (newBlockFields.color ?? "").trim();
      if (mode !== "color" && mode !== "image") {
        errors.mode = "required";
      } else {
        normalized.mode = mode;
      }

      if (mode === "color") {
        if (!color) {
          errors.color = "required";
        } else if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
          errors.color = "invalid";
        } else {
          normalized.color = color;
        }
        normalized.image_path = "";
      } else if (mode === "image") {
        if (!imagePath) {
          errors.image_path = "required";
        } else {
          normalized.image_path = imagePath;
        }
        normalized.color = "";
      }
    }

    return {
      errors,
      normalizedValues: normalized,
      isValid: Object.keys(errors).length === 0,
    };
  }, [blocks, newBlockFields, newBlockName, newBlockType]);

  const createFieldConfigs = useMemo(
    () => createFieldConfigByType[newBlockType] ?? [],
    [newBlockType]
  );
  const requiredFieldKeys = new Set(requiredFieldKeysByType[newBlockType] ?? []);

  function isFieldRequired(fieldKey: string) {
    if (requiredFieldKeys.has(fieldKey)) return true;
    if (newBlockType === "background") {
      const mode = newBlockFields.mode === "image" ? "image" : "color";
      if (fieldKey === "mode") return true;
      if (fieldKey === "image_path") return mode === "image";
      if (fieldKey === "color") return mode === "color";
    }
    return false;
  }

  function getCreateFieldErrorMessage(fieldKey: string) {
    const errorType = createValidation.errors[fieldKey];
    if (!errorType) return null;
    if (errorType === "required") return "필수 입력 항목입니다.";
    if (errorType === "duplicate") return "동일한 이름의 block이 이미 존재합니다.";
    if (errorType === "invalid") {
      if (fieldKey === "color") return "HEX 색상 형식으로 입력하세요. (예: #112233)";
      if (fieldKey === "crop") return "JSON 형식이 올바르지 않습니다.";
      if (fieldKey === "start_at" || fieldKey === "end_at") return "날짜/시간 형식이 올바르지 않습니다.";
      return "입력 형식이 올바르지 않습니다.";
    }
    return "입력값을 확인해주세요.";
  }

  const hasCreateValidationError =
    showCreateValidation && Object.keys(createValidation.errors).length > 0;

  const visibleCreateFieldKeys = useMemo(() => {
    const keys = ["name"];
    for (const field of createFieldConfigs) {
      if (newBlockType === "background") {
        const mode = newBlockFields.mode === "image" ? "image" : "color";
        if (field.key === "image_path" && mode !== "image") continue;
        if (field.key === "color" && mode !== "color") continue;
      }
      keys.push(field.key);
    }
    return keys;
  }, [createFieldConfigs, newBlockFields.mode, newBlockType]);

  const firstCreateErrorFieldKey = useMemo(() => {
    if (!showCreateValidation) return null;
    for (const key of visibleCreateFieldKeys) {
      if (createValidation.errors[key]) return key;
    }
    return null;
  }, [createValidation.errors, showCreateValidation, visibleCreateFieldKeys]);

  function shouldShowCreateFieldMessage(fieldKey: string) {
    return firstCreateErrorFieldKey === fieldKey;
  }

  function isPrimaryCreateErrorField(fieldKey: string) {
    return showCreateValidation && firstCreateErrorFieldKey === fieldKey;
  }

  useEffect(() => {
    if (!openSizeMenuId) return;
    const update = () => setSizeMenuRect(readAnchorRect(sizeButtonRef.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [openSizeMenuId]);

  useEffect(() => {
    if (!openCreateTypeMenu) return;
    const update = () => setCreateTypeMenuRect(readAnchorRect(createTypeButtonRef.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [openCreateTypeMenu]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      if (openSizeMenuId) {
        if (sizeButtonRef.current?.contains(target)) return;
        if (sizeMenuRef.current?.contains(target)) return;
        setOpenSizeMenuId(null);
        setSizeMenuRect(null);
      }

      if (openCreateTypeMenu) {
        if (createTypeButtonRef.current?.contains(target)) return;
        if (createTypeMenuRef.current?.contains(target)) return;
        setOpenCreateTypeMenu(false);
        setCreateTypeMenuRect(null);
      }
    }

    if (!openSizeMenuId && !openCreateTypeMenu) return;
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openCreateTypeMenu, openSizeMenuId]);

  useEffect(() => {
    if (!showCreateBlockForm || creatingBlock) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      if (createFormRef.current?.contains(target)) return;
      if (createTriggerRef.current?.contains(target)) return;
      if (createTypeMenuRef.current?.contains(target)) return;

      setShowCreateBlockForm(false);
      setCreateBlockError(null);
      setShowCreateValidation(false);
      setNewBlockName("");
      setNewBlockType("txt");
      setNewBlockFields({ title: "", content: "" });
      setOpenCreateTypeMenu(false);
      setCreateTypeMenuRect(null);
      autoCreateRequestedRef.current = false;
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [creatingBlock, showCreateBlockForm]);

  return (
    <div
      ref={shellRef}
      className="flex h-[calc(100vh-3.5rem)] min-h-[640px] w-full gap-0 overflow-hidden bg-gray-100/70 dark:bg-gray-950"
    >
      <section
        className="overflow-auto border-y border-l border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
        style={{ width: leftWidth }}
      >
        <div className="px-4 py-4">
          <div className="px-2">
            <p className="mb-1.5 select-none text-[10px] font-medium text-gray-500 dark:text-gray-400">
              project
            </p>
            <Link
              href={`/projects/${initialData.project.id}`}
              className="group flex h-7 cursor-pointer items-center justify-between rounded-md px-2 text-[11px] font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <span className="truncate">{initialData.project.name || "Project"}</span>
              <span className="ml-2 text-[10px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-400">
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <ChevronRightIcon className="h-3 w-3" />
                </span>
              </span>
            </Link>
          </div>

          <div className="my-3 px-2">
            <div className="h-px bg-gray-200 dark:bg-white/10" />
          </div>

          <div className="px-2">
            <p className="mb-1.5 select-none text-[10px] font-medium text-gray-500 dark:text-gray-400">
              template
            </p>
            <div className="space-y-1.5">
              {activeTemplate ? (
                <div key={activeTemplate.id} className="rounded-md px-2 py-1">
                  <div className="grid gap-1">
                    <div className="flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/10">
                      <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                        id
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-[11px] font-normal text-gray-700 dark:text-gray-200"
                        title={activeTemplate.id}
                      >
                        {formatShortId(activeTemplate.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyTemplateId(activeTemplate.id)}
                        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[11px] text-gray-500 dark:text-gray-400"
                        aria-label="Copy template id"
                        title={copiedTemplateId === activeTemplate.id ? "복사됨" : "ID 복사"}
                      >
                        {copiedTemplateId === activeTemplate.id ? (
                          <CheckIcon className="h-3 w-3" />
                        ) : (
                          <ClipboardCopyIcon className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    <label className="flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-50 focus-within:bg-gray-100 focus-within:hover:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15 dark:focus-within:hover:bg-white/15">
                      <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                        name
                      </span>
                      <input
                        type="text"
                        value={activeTemplate.name}
                        onChange={(e) => patchTemplateNameLocal(activeTemplate.id, e.target.value)}
                        onBlur={() => saveTemplateName(activeTemplate.id, activeTemplate.name)}
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-normal text-gray-700 outline-none dark:text-gray-200"
                      />
                    </label>

                    <InlineSelectRow
                      label="type"
                      value={activeTemplate.type}
                      options={templateTypeOptions}
                      onChange={(nextType) => {
                        patchTemplateTypeLocal(activeTemplate.id, nextType);
                        void saveTemplateType(activeTemplate.id, nextType);
                      }}
                    />

                    <div>
                      <button
                        ref={sizeButtonRef}
                        type="button"
                        onClick={() =>
                          setOpenSizeMenuId((prev) => {
                            const next = prev === activeTemplate.id ? null : activeTemplate.id;
                            setSizeMenuRect(next ? readAnchorRect(sizeButtonRef.current) : null);
                            return next;
                          })
                        }
                        className={`group flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors dark:hover:bg-white/10 ${
                          openSizeMenuId === activeTemplate.id
                            ? "bg-gray-100 dark:bg-white/15"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                          size
                        </span>
                        <span className="min-w-0 flex-1 text-[11px] font-normal text-gray-700 dark:text-gray-200">
                          {activeTemplate.width}
                          <span className="mx-1.5 inline-block w-3 text-center text-gray-500 dark:text-gray-400">
                            x
                          </span>
                          {activeTemplate.height}
                        </span>
                        <span
                          className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 dark:text-gray-400"
                          aria-hidden="true"
                        >
                          <ChevronDownIcon className="h-3 w-3" />
                        </span>
                      </button>

                      {openSizeMenuId === activeTemplate.id && sizeMenuRect && (
                        <div
                          ref={sizeMenuRef}
                          className="fixed z-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-gray-900"
                          style={{
                            top: sizeMenuRect.top,
                            left: sizeMenuRect.left,
                            width: sizeMenuRect.width,
                          }}
                        >
                          <div className="max-h-40 overflow-auto p-1">
                            {sizePresets.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  void applyTemplateSize(
                                    activeTemplate.id,
                                    preset.width,
                                    preset.height
                                  );
                                  setOpenSizeMenuId(null);
                                  setSizeMenuRect(null);
                                }}
                                className="block w-full rounded px-2 py-1 text-left text-[10px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <div className="border-t border-gray-200 p-2 dark:border-white/10">
                            <p className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
                              직접 입력
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                value={sizeDrafts[activeTemplate.id]?.width ?? ""}
                                onChange={(e) =>
                                  patchSizeDraft(activeTemplate.id, "width", e.target.value)
                                }
                                className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-[10px] text-gray-700 outline-none [appearance:textfield] focus:border-indigo-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:border-white/15 dark:bg-gray-900 dark:text-gray-200"
                              />
                              <span className="w-3 text-center text-[10px] text-gray-500 dark:text-gray-400">
                                x
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={sizeDrafts[activeTemplate.id]?.height ?? ""}
                                onChange={(e) =>
                                  patchSizeDraft(activeTemplate.id, "height", e.target.value)
                                }
                                className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-[10px] text-gray-700 outline-none [appearance:textfield] focus:border-indigo-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:border-white/15 dark:bg-gray-900 dark:text-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const width = clampMin1(
                                    Number(sizeDrafts[activeTemplate.id]?.width) || 1
                                  );
                                  const height = clampMin1(
                                    Number(sizeDrafts[activeTemplate.id]?.height) || 1
                                  );
                                  void applyTemplateSize(activeTemplate.id, width, height);
                                  setOpenSizeMenuId(null);
                                  setSizeMenuRect(null);
                                }}
                                className="h-7 shrink-0 rounded border border-gray-200 px-2 text-[10px] font-medium text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                              >
                                적용
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    
                  </div>
                </div>
              ) : (
                <div className="px-2 py-2 text-[11px] text-gray-500 dark:text-gray-400">
                  template 데이터가 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="my-3 px-2">
            <div className="h-px bg-gray-200 dark:bg-white/10" />
          </div>

          <div className="px-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="select-none text-[10px] font-medium text-gray-500 dark:text-gray-400">
                blocks
              </p>
              <button
                ref={createTriggerRef}
                type="button"
                onClick={() => {
                  setShowCreateBlockForm((prev) => {
                    const next = !prev;
                    if (next) {
                      setCreateBlockError(null);
                      setShowCreateValidation(false);
                      autoCreateRequestedRef.current = false;
                    } else {
                      setOpenCreateTypeMenu(false);
                      setCreateTypeMenuRect(null);
                    }
                    return next;
                  });
                }}
                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[15px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
                aria-label="Add block"
              >
                <PlusIcon className="h-3 w-3" />
              </button>
            </div>

            {showCreateBlockForm && (
              <div
                ref={createFormRef}
                className={`mb-2 rounded-md border border-dashed p-1 ${
                  hasCreateValidationError
                    ? "border-red-300/80 dark:border-red-400/60"
                    : "border-blue-300/70 dark:border-blue-400/40"
                }`}
              >
                <button
                  type="button"
                  className="w-full cursor-default rounded-md px-2 py-1.5 text-left text-gray-700 dark:text-gray-200"
                >
                  <div className="flex items-center">
                    <p className="truncate text-[11px] font-medium">
                      {newBlockName.trim() || "New block"}
                    </p>
                  </div>
                </button>

                <div className="mt-0.5 grid gap-0.5 rounded-md px-2 py-0 text-[10px] text-gray-600 dark:text-gray-300">
                  <div>
                    <button
                      ref={createTypeButtonRef}
                      type="button"
                      onClick={() => {
                        setOpenCreateTypeMenu((prev) => {
                          const next = !prev;
                          setCreateTypeMenuRect(
                            next ? readAnchorRect(createTypeButtonRef.current) : null
                          );
                          return next;
                        });
                      }}
                      className={`group flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors dark:hover:bg-white/10 ${
                        openCreateTypeMenu
                          ? "bg-gray-100 dark:bg-white/15"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                        type
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-gray-700 dark:text-gray-200">
                        {newBlockType}
                      </span>
                      <span
                        className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 dark:text-gray-400"
                        aria-hidden="true"
                      >
                        <ChevronDownIcon className="h-3 w-3" />
                      </span>
                    </button>

                    {openCreateTypeMenu && createTypeMenuRect && (
                      <div
                        ref={createTypeMenuRef}
                        className="fixed z-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-gray-900"
                        style={{
                          top: createTypeMenuRect.top,
                          left: createTypeMenuRect.left,
                          width: createTypeMenuRect.width,
                        }}
                      >
                        <div className="p-1">
                          {Object.keys(createFieldConfigByType).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setNewBlockType(type);
                                resetCreateBlockDraft(type);
                                autoCreateRequestedRef.current = false;
                                setOpenCreateTypeMenu(false);
                                setCreateTypeMenuRect(null);
                              }}
                              className="block w-full rounded px-2 py-1 text-left text-[10px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <label
                    className={`flex h-7 items-center gap-3 rounded-md border px-2 transition-colors hover:bg-gray-100 focus-within:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15 ${
                      isPrimaryCreateErrorField("name")
                        ? "border-red-300 bg-red-50/40 dark:border-red-400/60 dark:bg-red-500/10"
                        : "border-transparent"
                    }`}
                  >
                    <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                      name *
                    </span>
                    <input
                      type="text"
                      value={newBlockName}
                      onChange={(e) => {
                        setNewBlockName(e.target.value);
                        autoCreateRequestedRef.current = false;
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[11px] font-normal text-gray-700 outline-none dark:text-gray-200"
                    />
                  </label>
                  {shouldShowCreateFieldMessage("name") && getCreateFieldErrorMessage("name") && (
                    <p className="px-2 text-[9px] text-red-600 dark:text-red-400">
                      {getCreateFieldErrorMessage("name")}
                    </p>
                  )}

                  {createFieldConfigs
                    .filter((field) => {
                      if (newBlockType !== "background") return true;
                      const mode = newBlockFields.mode === "image" ? "image" : "color";
                      if (field.key === "image_path") return mode === "image";
                      if (field.key === "color") return mode === "color";
                      return true;
                    })
                    .map((field) => (
                      <div key={`new-${field.key}`}>
                        {(() => {
                          const fieldError = isPrimaryCreateErrorField(field.key);
                          return (
                        <label
                          className={`flex h-7 items-center gap-3 rounded-md border px-2 transition-colors hover:bg-gray-100 focus-within:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15 ${
                            fieldError
                              ? "border-red-300 bg-red-50/40 dark:border-red-400/60 dark:bg-red-500/10"
                              : "border-transparent"
                          }`}
                        >
                          <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                            {field.label}
                            {isFieldRequired(field.key) ? " *" : ""}
                          </span>
                          {field.key === "mode" ? (
                            <div className="min-w-0 flex-1">
                              <InlineSelectRow
                                value={newBlockFields.mode === "image" ? "image" : "color"}
                                options={[
                                  { value: "color", label: "color" },
                                  { value: "image", label: "image" },
                                ]}
                                onChange={(mode) => {
                                  const nextMode = mode === "image" ? "image" : "color";
                                  setNewBlockFields((prev) => ({
                                    ...prev,
                                    mode: nextMode,
                                    image_path: nextMode === "image" ? prev.image_path ?? "" : "",
                                    color: nextMode === "color" ? prev.color ?? "" : "",
                                  }));
                                  autoCreateRequestedRef.current = false;
                                }}
                              />
                            </div>
                          ) : newBlockType === "background" && field.key === "image_path" ? (
                            <div className="min-w-0 flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const nextValue = e.target.files?.[0]?.name ?? "";
                                  setNewBlockFields((prev) => ({
                                    ...prev,
                                    image_path: nextValue,
                                  }));
                                  autoCreateRequestedRef.current = false;
                                }}
                                className="block w-full cursor-pointer text-[11px] text-gray-700 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-[10px] file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-200 dark:file:bg-white/10 dark:file:text-gray-200 dark:hover:file:bg-white/15"
                              />
                              <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                                {newBlockFields.image_path || "선택된 파일 없음"}
                              </p>
                            </div>
                          ) : newBlockType === "background" && field.key === "color" ? (
                            <ColorPickerField
                              value={newBlockFields.color || "#000000"}
                              onChange={(nextColor) => {
                                setNewBlockFields((prev) => ({
                                  ...prev,
                                  color: nextColor,
                                }));
                                autoCreateRequestedRef.current = false;
                              }}
                            />
                          ) : (
                            <input
                              type={field.inputType ?? "text"}
                              value={newBlockFields[field.key] ?? ""}
                              onChange={(e) => {
                                setNewBlockFields((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }));
                                autoCreateRequestedRef.current = false;
                              }}
                              className="min-w-0 flex-1 bg-transparent text-[11px] font-normal text-gray-700 outline-none dark:text-gray-200"
                            />
                          )}
                        </label>
                          );
                        })()}
                        {shouldShowCreateFieldMessage(field.key) &&
                          getCreateFieldErrorMessage(field.key) && (
                          <p className="px-2 text-[9px] text-red-600 dark:text-red-400">
                            {getCreateFieldErrorMessage(field.key)}
                          </p>
                        )}
                      </div>
                    ))}

                  {creatingBlock && (
                    <p className="px-2 text-[10px] text-gray-500 dark:text-gray-400">
                      생성 중...
                    </p>
                  )}
                  {createBlockError && (
                    <p className="px-2 text-[10px] text-red-600 dark:text-red-400">
                      {createBlockError}
                    </p>
                  )}

                  <div className="px-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateValidation(true);
                        if (creatingBlock || !createValidation.isValid) return;
                        void createBlock(createValidation.normalizedValues);
                      }}
                      className="h-7 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[11px] font-normal text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                    >
                      confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {sortedBlocks.map((block) => {
                const active = selectedNode?.blockId === block.id;
                const latestRender = latestRenderByBlock.get(block.id);
                const expanded = openBlockIds.includes(block.id);

                return (
                  <div key={block.id} className="rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBlockIds((prev) => {
                          const isOpen = prev.includes(block.id);
                          return isOpen
                            ? prev.filter((id) => id !== block.id)
                            : [...prev, block.id];
                        });
                        if (latestRender) {
                          setSelectedId(latestRender.id);
                        }
                      }}
                      className={`group w-full cursor-pointer rounded-md px-2 py-1.5 text-left transition ${
                        active
                          ? "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-white/15 dark:text-white dark:hover:bg-white/20"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-[11px] font-medium">{block.name}</p>
                        <span
                          className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 dark:text-gray-400"
                          aria-hidden="true"
                        >
                          {expanded ? (
                            <MinusIcon className="h-3 w-3" />
                          ) : (
                            <HamburgerMenuIcon className="h-3 w-3" />
                          )}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-0.5 grid gap-0.5 rounded-md px-2 py-0 text-[10px] text-gray-600 dark:text-gray-300">
                        {(editableVersionFieldsByType[block.type] ?? [])
                          .filter((field) => {
                            if (block.type !== "background") return true;
                            const mode =
                              block.currentVersionData?.mode === "image" ? "image" : "color";
                            if (field === "image_path") return mode === "image";
                            if (field === "color") return mode === "color";
                            return true;
                          })
                          .map((field) => (
                          <label
                            key={`${block.id}-${field}`}
                            className="flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-100 focus-within:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15"
                          >
                            <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
                              {field}
                            </span>
                            {field === "mode" ? (
                              <div className="flex min-w-0 flex-1 items-center">
                                <select
                                  value={block.currentVersionData?.mode === "image" ? "image" : "color"}
                                  onChange={(e) => {
                                    const mode = e.target.value === "image" ? "image" : "color";
                                    patchBlockCurrentVersionFieldLocal(block.id, "mode", mode);
                                    if (mode === "color") {
                                      patchBlockCurrentVersionFieldLocal(block.id, "image_path", "");
                                    } else {
                                      patchBlockCurrentVersionFieldLocal(block.id, "color", "");
                                    }
                                  }}
                                  className="min-w-0 flex-1 appearance-none bg-transparent pr-1 text-[11px] font-normal text-gray-700 outline-none dark:text-gray-200"
                                >
                                  <option value="color">color</option>
                                  <option value="image">image</option>
                                </select>
                                <span
                                  className="ml-1 inline-flex h-5 w-5 items-center justify-center text-gray-500 dark:text-gray-400"
                                  aria-hidden="true"
                                >
                                  <ChevronDownIcon className="h-3 w-3" />
                                </span>
                              </div>
                            ) : block.type === "background" && field === "image_path" ? (
                              <div className="min-w-0 flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const nextValue = e.target.files?.[0]?.name ?? "";
                                    patchBlockCurrentVersionFieldLocal(
                                      block.id,
                                      "image_path",
                                      nextValue
                                    );
                                    void saveBlockCurrentVersionField(
                                      {
                                        ...block,
                                        currentVersionData: {
                                          ...(block.currentVersionData ?? {}),
                                          mode: block.currentVersionData?.mode ?? "image",
                                          image_path: nextValue,
                                        },
                                      },
                                      "image_path",
                                      nextValue
                                    );
                                  }}
                                  className="block w-full cursor-pointer text-[11px] text-gray-700 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-[10px] file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-200 dark:file:bg-white/10 dark:file:text-gray-200 dark:hover:file:bg-white/15"
                                />
                                <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                                  {block.currentVersionData?.image_path || "선택된 파일 없음"}
                                </p>
                              </div>
                            ) : block.type === "background" && field === "color" ? (
                              <ColorPickerField
                                value={block.currentVersionData?.color || "#000000"}
                                onChange={(nextColor) =>
                                  patchBlockCurrentVersionFieldLocal(block.id, "color", nextColor)
                                }
                                onCommit={(nextColor) =>
                                  void saveBlockCurrentVersionField(
                                    {
                                      ...block,
                                      currentVersionData: {
                                        ...(block.currentVersionData ?? {}),
                                        mode: block.currentVersionData?.mode ?? "color",
                                        color: nextColor,
                                      },
                                    },
                                    "color",
                                    nextColor
                                  )
                                }
                              />
                            ) : (
                              <input
                                type="text"
                                value={block.currentVersionData?.[field] ?? ""}
                                onChange={(e) =>
                                  patchBlockCurrentVersionFieldLocal(
                                    block.id,
                                    field,
                                    e.target.value
                                  )
                                }
                                onBlur={(e) =>
                                  void saveBlockCurrentVersionField(
                                    block,
                                    field,
                                    e.target.value
                                  )
                                }
                                className="min-w-0 flex-1 bg-transparent text-[11px] font-normal text-gray-700 outline-none dark:text-gray-200"
                              />
                            )}
                          </label>
                        ))}
                        {!(editableVersionFieldsByType[block.type] ?? []).length && (
                          <div className="px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400">
                            editable field가 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {sortedBlocks.length === 0 && !showCreateBlockForm && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-md px-2 py-6 text-gray-400 dark:text-gray-500">
                  <FileTextIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[11px]">No blocks yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        aria-label="왼쪽 패널 크기 조정"
        onPointerDown={(e) => startResize("left", e.clientX)}
        className="group relative -mx-px w-0 shrink-0 cursor-col-resize"
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-indigo-400 dark:bg-white/15 dark:group-hover:bg-indigo-500" />
        <span className="absolute inset-y-0 -left-[6px] w-3" />
      </button>

      <section className="min-w-[720px] flex-1 border-y border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">
            Block Editor
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400">Render {nodes.length}</span>
        </div>

        <div className="px-4 py-3">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Block 단위 선택</p>
          <div className="flex flex-wrap gap-2">
            {nodes.map((node) => {
              const active = node.id === selectedId;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs ${
                    active
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-500/15 dark:text-indigo-200"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
                  }`}
                >
                  {node.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Block 추가</p>
          <div className="flex flex-wrap gap-2">
            {sortedBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => void addNodeFromBlock(block.id)}
                className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/15 dark:text-gray-200 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10"
              >
                + {block.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div
            className="relative mx-auto overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-white/20 dark:bg-black"
            style={{
              width: previewFrame.displayWidth,
              height: previewFrame.displayHeight,
            }}
          >
            {sortedNodes.map((node) => {
              const selected = selectedId === node.id;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  className={`absolute overflow-hidden rounded border text-left transition ${
                    selected
                      ? "border-indigo-500 ring-2 ring-indigo-300/60"
                      : "border-gray-300 hover:border-indigo-300 dark:border-white/20"
                  } ${
                    node.type === "background"
                      ? "bg-gray-300/80 text-gray-800 dark:bg-gray-700/70 dark:text-gray-100"
                      : "bg-white/90 text-gray-900 dark:bg-gray-900/90 dark:text-gray-100"
                  }`}
                  style={{
                    left: node.location.x * previewFrame.scaleX,
                    top: node.location.y * previewFrame.scaleY,
                    width:
                      (node.type === "background"
                        ? previewFrame.sourceWidth
                        : (node.size?.width ?? 320)) * previewFrame.scaleX,
                    height:
                      (node.type === "background"
                        ? previewFrame.sourceHeight
                        : (node.size?.height ?? 96)) * previewFrame.scaleY,
                    zIndex: node.location.z,
                  }}
                >
                  <div className="flex h-full w-full items-start justify-between p-2 text-xs">
                    <span>{node.label}</span>
                    <span className="rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/10">z:{node.location.z}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-500 dark:text-gray-400">
            Preview Size: {previewFrame.sourceWidth} x {previewFrame.sourceHeight}
          </p>
        </div>
      </section>

      <button
        type="button"
        aria-label="오른쪽 패널 크기 조정"
        onPointerDown={(e) => startResize("right", e.clientX)}
        className="group relative -mx-px w-0 shrink-0 cursor-col-resize"
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-indigo-400 dark:bg-white/15 dark:group-hover:bg-indigo-500" />
        <span className="absolute inset-y-0 -left-[6px] w-3" />
      </button>

      <section
        className="overflow-auto border-y border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
        style={{ width: rightWidth }}
      >
        <div className="px-4 pb-2 pt-4">
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">
            Render Detail
          </p>
        </div>

        {!selectedNode ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">선택된 Render가 없습니다.</p>
        ) : (
          <div className="space-y-4 p-4 text-sm">
            <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="font-medium text-gray-900 dark:text-white">{selectedNode.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedNode.id} / {selectedNode.blockId}
              </p>
            </div>

            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Block Name</span>
              <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
                {selectedNode.label}
              </div>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={selectedNode.location.x}
                onChange={(value) =>
                  patchSelected((node) => ({
                    ...node,
                    location: { ...node.location, x: value },
                  }))
                }
              />
              <NumberField
                label="Y"
                value={selectedNode.location.y}
                onChange={(value) =>
                  patchSelected((node) => ({
                    ...node,
                    location: { ...node.location, y: value },
                  }))
                }
              />
              <NumberField
                label="Width"
                value={selectedRenderWidth}
                disabled={selectedNode.type === "background"}
                onChange={(value) =>
                  patchSelected((node) => ({
                    ...node,
                    size:
                      node.type === "background"
                        ? null
                        : {
                            width: Math.max(40, value),
                            height: node.size?.height ?? 96,
                          },
                  }))
                }
              />
              <NumberField
                label="Height"
                value={selectedRenderHeight}
                disabled={selectedNode.type === "background"}
                onChange={(value) =>
                  patchSelected((node) => ({
                    ...node,
                    size:
                      node.type === "background"
                        ? null
                        : {
                            width: node.size?.width ?? 320,
                            height: Math.max(40, value),
                          },
                  }))
                }
              />
            </div>

            <NumberField
              label="Z-Index"
              value={selectedNode.location.z}
              onChange={(value) =>
                patchSelected((node) => ({
                  ...node,
                  location: { ...node.location, z: Math.max(0, value) },
                }))
              }
            />

            <button
              onClick={() => void removeSelected()}
              className="w-full rounded-md bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
            >
              선택 Render 삭제
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
