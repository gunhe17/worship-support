"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAddSection,
  useDeleteSection,
  useDeleteSong,
  useReorderSections,
  useSongDetail,
  useUpdateSection,
  useUpdateSong,
} from "@/hooks/useSong";
import type { SongSection } from "@/types";

const SECTION_TYPES = [
  "INTRO",
  "VERSE1", "VERSE2", "VERSE3", "VERSE4",
  "PRE_CHORUS",
  "CHORUS",
  "BRIDGE",
  "INTERLUDE",
  "OUTRO",
];

const SECTION_LABELS: Record<string, string> = {
  INTRO: "인트로",
  VERSE1: "벌스 1", VERSE2: "벌스 2", VERSE3: "벌스 3", VERSE4: "벌스 4",
  PRE_CHORUS: "프리코러스",
  CHORUS: "코러스",
  BRIDGE: "브릿지",
  INTERLUDE: "인터루드",
  OUTRO: "아웃트로",
};

const SECTION_COLORS: Record<string, string> = {
  INTRO: "bg-gray-100 text-gray-500",
  VERSE1: "bg-blue-50 text-blue-600", VERSE2: "bg-blue-50 text-blue-600",
  VERSE3: "bg-blue-50 text-blue-600", VERSE4: "bg-blue-50 text-blue-600",
  PRE_CHORUS: "bg-purple-50 text-purple-600",
  CHORUS: "bg-orange-50 text-orange-600",
  BRIDGE: "bg-pink-50 text-pink-600",
  INTERLUDE: "bg-yellow-50 text-yellow-600",
  OUTRO: "bg-gray-100 text-gray-500",
};

function SectionForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "저장",
}: {
  initial?: { section_type?: string; lyrics?: string };
  onSubmit: (data: { section_type: string; section_label: string; lyrics: string; bars: number }) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel?: string;
}) {
  const [sectionType, setSectionType] = useState(initial?.section_type ?? "VERSE1");
  const [lyrics, setLyrics] = useState(initial?.lyrics ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      section_type: sectionType,
      section_label: SECTION_LABELS[sectionType] || sectionType,
      lyrics,
      bars: 8,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">구간</label>
        <select
          value={sectionType}
          onChange={(e) => setSectionType(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t} — {SECTION_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">가사</label>
        <textarea
          rows={6}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="이 구간 가사를 붙여넣어 주세요"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none leading-relaxed"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600">
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
        >
          {isPending ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function SectionCard({
  section,
  songId,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  section: SongSection;
  songId: string;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { mutate: updateSection, isPending } = useUpdateSection(songId);
  const { mutate: deleteSection } = useDeleteSection(songId);

  const colorClass = SECTION_COLORS[section.section_type] ?? "bg-gray-100 text-gray-500";

  if (editing) {
    return (
      <SectionForm
        initial={{ section_type: section.section_type, lyrics: section.lyrics }}
        onSubmit={(data) =>
          updateSection(
            { id: section.id, ...data },
            { onSuccess: () => setEditing(false) }
          )
        }
        onCancel={() => setEditing(false)}
        isPending={isPending}
      />
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(section.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(section.id)}
      className="bg-white border border-gray-200 rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-300 select-none text-base">⠿</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${colorClass}`}>
          {section.section_type}
        </span>
        <span className="text-sm text-gray-600 flex-1 truncate">{section.section_label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {section.lyrics && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              {expanded ? "접기" : "가사"}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-primary-500 px-1">
            수정
          </button>
          <button
            onClick={() => {
              if (confirm(`"${section.section_label}" 구간을 삭제할까요?`)) deleteSection(section.id);
            }}
            className="text-xs text-gray-300 hover:text-red-400 px-1"
          >
            삭제
          </button>
        </div>
      </div>
      {expanded && section.lyrics && (
        <div className="mt-2.5 ml-8 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-2.5">
          {section.lyrics}
        </div>
      )}
    </div>
  );
}

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const dragId = useRef<string | null>(null);

  const { data: song, isLoading } = useSongDetail(id);
  const { mutate: updateSong, isPending: isSaving } = useUpdateSong();
  const { mutate: deleteSong } = useDeleteSong();
  const { mutate: addSection, isPending: isAdding } = useAddSection(id);
  const { mutate: reorder } = useReorderSections(id);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setArtist(song.artist === "미상" ? "" : song.artist);
      setLyrics(song.lyrics);
    }
  }, [song]);

  const handleSave = () => {
    updateSong({
      id,
      title,
      artist: artist || "미상",
      lyrics,
      default_key: song?.default_key ?? "C",
      bpm: song?.bpm ?? 80,
      category: song?.category ?? "찬양",
    });
  };

  const handleDrop = (targetId: string) => {
    if (!dragId.current || !song || dragId.current === targetId) return;
    const ordered = [...song.sections].sort((a, b) => a.order - b.order);
    const fromIdx = ordered.findIndex((s) => s.id === dragId.current);
    const toIdx = ordered.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ordered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reorder(reordered.map((s) => s.id));
    dragId.current = null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">찬양을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const sections = [...song.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-2xl space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/songs")}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          ← 찬양 목록
        </button>
        <button
          onClick={() => {
            if (confirm("이 찬양을 삭제할까요?"))
              deleteSong(id, { onSuccess: () => router.push("/songs") });
          }}
          className="text-sm text-red-400 hover:text-red-600"
        >
          삭제
        </button>
      </div>

      {/* 곡 기본 정보 + 가사 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="곡 제목"
            className="w-full text-xl font-bold text-gray-900 border-0 border-b border-gray-100 pb-1 focus:outline-none focus:border-primary-300 bg-transparent"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="아티스트 (선택)"
            className="w-full text-sm text-gray-400 border-0 focus:outline-none bg-transparent focus:text-gray-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">가사 전체</label>
          <textarea
            rows={14}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="가사를 붙여넣어 주세요"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none leading-relaxed"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 구간 구성 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">구간 구성</h2>
          <button
            onClick={() => setShowAddSection(!showAddSection)}
            className="text-sm px-3 py-1.5 border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50"
          >
            {showAddSection ? "취소" : "+ 구간 추가"}
          </button>
        </div>

        {/* 송폼 흐름 미리보기 */}
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-1 py-2 px-3 bg-gray-50 rounded-lg">
            {sections.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SECTION_COLORS[s.section_type] ?? "bg-gray-100 text-gray-500"}`}>
                  {s.section_label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 구간 추가 폼 */}
        {showAddSection && (
          <SectionForm
            onSubmit={(data) =>
              addSection(
                { ...data, order: sections.length },
                { onSuccess: () => setShowAddSection(false) }
              )
            }
            onCancel={() => setShowAddSection(false)}
            isPending={isAdding}
            submitLabel="구간 추가"
          />
        )}

        {/* 구간 목록 */}
        {sections.length === 0 && !showAddSection ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <p>아직 구간이 없습니다.</p>
            <p className="mt-1 text-xs">위 가사를 참고해서 구간을 추가해 주세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                songId={id}
                onDragStart={(sectionId) => { dragId.current = sectionId; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
