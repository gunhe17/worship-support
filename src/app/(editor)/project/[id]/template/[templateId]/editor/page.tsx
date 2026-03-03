import { createClient } from "@/lib/supabase/server";
import { AppTopBar } from "@/components";
import { TemplateEditor, type EditorInitialData } from "@/components/template-editor";
import { notFound, redirect } from "next/navigation";

type TemplateRow = {
  id: string;
  project_id: string;
  name: string;
  type: string;
  updated_at: string;
  width: number | null;
  height: number | null;
};

type ProjectRow = {
  id: string;
  name: string;
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  current_version_id: string | null;
  updated_at: string;
};

type RenderQueryRow = {
  id: string;
  block_id: string;
  location: { x?: number; y?: number; z?: number } | null;
  size: { width?: number; height?: number } | null;
  updated_at: string;
  block:
    | {
        id: string;
        name: string;
        type: string;
      }
    | Array<{
        id: string;
        name: string;
        type: string;
      }>
    | null;
};

type CurrentVersionPayload = {
  id: string;
  values: Record<string, string>;
};

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function pushVersionId(bucket: Record<string, string[]>, type: string, id: string | null) {
  if (!id) return;
  if (!bucket[type]) bucket[type] = [];
  bucket[type].push(id);
}

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const supabase = await createClient();
  const { id, templateId } = await params;

  const { data } = await supabase
    .from("template")
    .select("id, project_id, name, type, updated_at, width, height")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  const requestedTemplate = (data as TemplateRow | null) ?? null;

  if (!requestedTemplate) {
    notFound();
  }

  if (requestedTemplate.project_id !== id) {
    redirect(`/project/${requestedTemplate.project_id}/template/${requestedTemplate.id}/editor`);
  }

  const projectId = requestedTemplate.project_id;

  const templatesQuery = supabase
    .from("template")
    .select("id, project_id, name, type, updated_at, width, height")
    .eq("project_id", projectId)
    .is("deleted_at", null);

  const { data: templateRows } = await templatesQuery.order("updated_at", { ascending: false }).limit(30);

  let templatesRaw = (templateRows ?? []) as TemplateRow[];
  if (!templatesRaw.some((template) => template.id === requestedTemplate.id)) {
    templatesRaw = [requestedTemplate, ...templatesRaw];
  }

  const selectedTemplateId = requestedTemplate.id;

  const selectedTemplate = templatesRaw.find(
    (template) => template.id === selectedTemplateId
  );
  const activeProjectId = projectId;

  let project: EditorInitialData["project"] = {
    id: activeProjectId,
    name: "Project",
  };

  if (activeProjectId) {
    const { data: projectRow } = await supabase
      .from("project")
      .select("id, name")
      .eq("id", activeProjectId)
      .is("deleted_at", null)
      .maybeSingle();

    const row = projectRow as ProjectRow | null;
    if (row) {
      project = { id: row.id, name: row.name };
    }
  }

  const templates: EditorInitialData["templates"] = templatesRaw.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    width: normalizeNumber(template.width, 1920),
    height: normalizeNumber(template.height, 1080),
    updatedAt: template.updated_at,
  }));

  let blocks: EditorInitialData["blocks"] = [];
  if (activeProjectId) {
    const { data: blockRows } = await supabase
      .from("block")
      .select("id, name, type, current_version_id, updated_at")
      .eq("project_id", activeProjectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);

    const blockRawRows = (blockRows ?? []) as BlockRow[];
    const versionIdsByType: Record<string, string[]> = {};

    for (const block of blockRawRows) {
      pushVersionId(versionIdsByType, block.type, block.current_version_id);
    }

    const versionPayloadMap = new Map<string, CurrentVersionPayload>();

    if ((versionIdsByType.txt ?? []).length > 0) {
      const { data } = await supabase
        .from("block_txt")
        .select("id, title, description, content")
        .in("id", versionIdsByType.txt);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
            content: row.content ?? "",
          },
        });
      }
    }

    if ((versionIdsByType.image ?? []).length > 0) {
      const { data } = await supabase
        .from("block_image")
        .select("id, title, description, image_path, crop")
        .in("id", versionIdsByType.image);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
            image_path: row.image_path ?? "",
            crop: row.crop ? JSON.stringify(row.crop) : "",
          },
        });
      }
    }

    if ((versionIdsByType.datetime ?? []).length > 0) {
      const { data } = await supabase
        .from("block_datetime")
        .select("id, title, description, start_at, end_at")
        .in("id", versionIdsByType.datetime);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
            start_at: row.start_at ?? "",
            end_at: row.end_at ?? "",
          },
        });
      }
    }

    if ((versionIdsByType.song ?? []).length > 0) {
      const { data } = await supabase
        .from("block_song")
        .select("id, title, description, reference_url, musical_key")
        .in("id", versionIdsByType.song);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
            reference_url: row.reference_url ?? "",
            musical_key: row.musical_key ?? "",
          },
        });
      }
    }

    if ((versionIdsByType.background ?? []).length > 0) {
      const { data } = await supabase
        .from("block_background")
        .select("id, mode, image_path, color")
        .in("id", versionIdsByType.background);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            mode: row.mode ?? "color",
            image_path: row.image_path ?? "",
            color: row.color ?? "",
          },
        });
      }
    }

    if ((versionIdsByType.song_list ?? []).length > 0) {
      const { data } = await supabase
        .from("block_song_list")
        .select("id, title, description, reference_url")
        .in("id", versionIdsByType.song_list);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
            reference_url: row.reference_url ?? "",
          },
        });
      }
    }

    if ((versionIdsByType.advertisement ?? []).length > 0) {
      const { data } = await supabase
        .from("block_advertisement")
        .select("id, title, description")
        .in("id", versionIdsByType.advertisement);
      for (const row of data ?? []) {
        versionPayloadMap.set(row.id, {
          id: row.id,
          values: {
            title: row.title ?? "",
            description: row.description ?? "",
          },
        });
      }
    }

    blocks = blockRawRows.map((block) => ({
      id: block.id,
      name: block.name,
      type: block.type,
      currentVersionId: block.current_version_id,
      currentVersionData: block.current_version_id
        ? (versionPayloadMap.get(block.current_version_id)?.values ?? null)
        : null,
      updatedAt: block.updated_at,
    }));
  }

  let nodes: EditorInitialData["nodes"] = [];
  if (selectedTemplateId) {
    const { data: renderRows } = await supabase
      .from("render")
      .select("id, block_id, location, size, updated_at, block:block_id(id, name, type)")
      .eq("template_id", selectedTemplateId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    nodes = ((renderRows ?? []) as RenderQueryRow[]).map((render) => {
      const block = Array.isArray(render.block) ? render.block[0] : render.block;
      const isBackground = block?.type === "background";
      return {
        id: render.id,
        blockId: render.block_id,
        label: block?.name || "Untitled block",
        type: block?.type || "txt",
        location: {
          x: normalizeNumber(render.location?.x, 0),
          y: normalizeNumber(render.location?.y, 0),
          z: normalizeNumber(render.location?.z, 0),
        },
        size: isBackground
          ? null
          : {
              width: normalizeNumber(render.size?.width, 320),
              height: normalizeNumber(render.size?.height, 96),
            },
        updatedAt: render.updated_at,
      };
    });
  }

  const initialData: EditorInitialData = {
    project,
    templates,
    blocks,
    nodes,
    selectedTemplateId: selectedTemplateId ?? null,
  };

  const headerType = selectedTemplate?.type ?? templates[0]?.type ?? "-";

  return (
    <div className="w-full">
      <header className="border-b border-gray-200 bg-white px-6 py-3 dark:border-white/10 dark:bg-gray-900">
        <AppTopBar
          leftSlot={
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Template Editor
              </h2>
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 dark:border-white/15 dark:text-gray-300">
                {headerType}
              </span>
            </div>
          }
          rightSlot={
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10">
                미리보기
              </button>
              <button className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                저장
              </button>
            </div>
          }
        />
      </header>
      <TemplateEditor initialData={initialData} />
    </div>
  );
}
