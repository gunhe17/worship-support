"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type BlockType = string;

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
  txt: ["title", "content"],
  image: ["title", "description", "image_path"],
  datetime: ["title", "description", "start_at", "end_at"],
  song: ["title", "description", "reference_url", "musical_key"],
  song_list: ["title", "description", "reference_url"],
  advertisement: ["title", "description"],
  background: ["title", "description", "image_path"],
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
  const [openTypeMenuId, setOpenTypeMenuId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [openBlockIds, setOpenBlockIds] = useState<string[]>([]);
  const [sizeMenuRect, setSizeMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [typeMenuRect, setTypeMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
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

  function readAnchorRect(el: HTMLElement | null) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
    };
  }

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

  async function createBlockVersion(
    blockId: string,
    type: string
  ): Promise<{ id: string; values: Record<string, string> } | null> {
    if (type === "txt") {
      const { data, error } = await supabase
        .from("block_txt")
        .insert({ block_id: blockId, content: "" })
        .select("id, title, content")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          content: data.content ?? "",
        },
      };
    }

    if (type === "image") {
      const { data, error } = await supabase
        .from("block_image")
        .insert({ block_id: blockId, image_path: "" })
        .select("id, title, description, image_path")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          image_path: data.image_path ?? "",
        },
      };
    }

    if (type === "datetime") {
      const { data, error } = await supabase
        .from("block_datetime")
        .insert({ block_id: blockId, start_at: new Date().toISOString() })
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
      const { data, error } = await supabase
        .from("block_song")
        .insert({ block_id: blockId, title: "" })
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
      const { data, error } = await supabase
        .from("block_song_list")
        .insert({ block_id: blockId })
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
      const { data, error } = await supabase
        .from("block_advertisement")
        .insert({ block_id: blockId, title: "", description: "" })
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
      const { data, error } = await supabase
        .from("block_background")
        .insert({ block_id: blockId, image_path: "" })
        .select("id, title, description, image_path")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        values: {
          title: data.title ?? "",
          description: data.description ?? "",
          image_path: data.image_path ?? "",
        },
      };
    }

    return null;
  }

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

    const { error } = await supabase
      .from(table)
      .update({ [field]: value })
      .eq("id", block.currentVersionId);

    if (error) {
      console.error("Failed to update block current version field", error);
    }
  }

  async function createBlock() {
    if (!initialData.project.id) {
      return;
    }

    const createdAt = new Date().toISOString();
    const defaultName = `새 블록 ${blocks.length + 1}`;
    const { data, error } = await supabase
      .from("block")
      .insert({
        project_id: initialData.project.id,
        type: "txt",
        name: defaultName,
      })
      .select("id, name, type, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to create block", error);
      return;
    }

    const version = await createBlockVersion(data.id, "txt");
    if (!version?.id) {
      console.error("Failed to create default block version");
      return;
    }

    const { error: linkError } = await supabase
      .from("block")
      .update({ current_version_id: version.id })
      .eq("id", data.id);
    if (linkError) {
      console.error("Failed to link current version", linkError);
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
  }

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

  useEffect(() => {
    if (!openTypeMenuId) return;
    const update = () => setTypeMenuRect(readAnchorRect(typeButtonRef.current));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [openTypeMenuId]);

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
                →
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
                      <span className="w-12 text-[10px] text-gray-500 dark:text-gray-400">
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
                        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
                        aria-label="Copy template id"
                        title={copiedTemplateId === activeTemplate.id ? "복사됨" : "ID 복사"}
                      >
                        {copiedTemplateId === activeTemplate.id ? "✓" : "⧉"}
                      </button>
                    </div>

                    <label className="flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-50 focus-within:bg-gray-100 focus-within:hover:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15 dark:focus-within:hover:bg-white/15">
                      <span className="w-12 text-[10px] text-gray-500 dark:text-gray-400">
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

                    <div>
                      <button
                        ref={typeButtonRef}
                        type="button"
                        onClick={() =>
                          setOpenTypeMenuId((prev) => {
                            const next = prev === activeTemplate.id ? null : activeTemplate.id;
                            setTypeMenuRect(next ? readAnchorRect(typeButtonRef.current) : null);
                            return next;
                          })
                        }
                        className={`flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors dark:hover:bg-white/10 ${
                          openTypeMenuId === activeTemplate.id
                            ? "bg-gray-100 dark:bg-white/15"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-12 text-[10px] text-gray-500 dark:text-gray-400">
                          type
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-gray-700 dark:text-gray-200">
                          {activeTemplate.type}
                        </span>
                      </button>

                      {openTypeMenuId === activeTemplate.id && typeMenuRect && (
                        <div
                          className="fixed z-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-gray-900"
                          style={{
                            top: typeMenuRect.top,
                            left: typeMenuRect.left,
                            width: typeMenuRect.width,
                          }}
                        >
                          <div className="p-1">
                            {templateTypeOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  patchTemplateTypeLocal(activeTemplate.id, option.value);
                                  void saveTemplateType(activeTemplate.id, option.value);
                                  setOpenTypeMenuId(null);
                                  setTypeMenuRect(null);
                                }}
                                className="block w-full rounded px-2 py-1 text-left text-[10px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

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
                        className={`flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors dark:hover:bg-white/10 ${
                          openSizeMenuId === activeTemplate.id
                            ? "bg-gray-100 dark:bg-white/15"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-12 text-[10px] text-gray-500 dark:text-gray-400">
                          size
                        </span>
                        <span className="min-w-0 flex-1 text-[11px] font-normal text-gray-700 dark:text-gray-200">
                          {activeTemplate.width}
                          <span className="mx-1.5 inline-block w-3 text-center text-gray-500 dark:text-gray-400">
                            x
                          </span>
                          {activeTemplate.height}
                        </span>
                      </button>

                      {openSizeMenuId === activeTemplate.id && sizeMenuRect && (
                        <div
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
                type="button"
                onClick={() => void createBlock()}
                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[15px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
                aria-label="Add block"
              >
                +
              </button>
            </div>

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
                        <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
                          {expanded ? "▾" : "-"}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-1 grid gap-1 rounded-md px-2 py-1.5 text-[10px] text-gray-600 dark:text-gray-300">
                        {(editableVersionFieldsByType[block.type] ?? []).map((field) => (
                          <label
                            key={`${block.id}-${field}`}
                            className="flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-100 focus-within:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15"
                          >
                            <span className="w-12 text-[10px] text-gray-500 dark:text-gray-400">
                              {field}
                            </span>
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
                          </label>
                        ))}
                        {!(editableVersionFieldsByType[block.type] ?? []).length && (
                          <div className="px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400">
                            editable field가 없습니다.
                          </div>
                        )}
                        {!latestRender && (
                          <button
                            type="button"
                            onClick={() => void addNodeFromBlock(block.id)}
                            className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-left text-[10px] text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                          >
                            + canvas에 추가
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {sortedBlocks.length === 0 && (
                <div className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                  block 데이터가 없습니다.
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
