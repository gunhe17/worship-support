"use client";

import { useState, useRef } from "react";
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

const SECTION_TYPE_LABELS: Record<string, string> = {
  INTRO: "인트로",
  VERSE1: "벌스 1", VERSE2: "벌스 2", VERSE3: "벌스 3", VERSE4: "벌스 4",
  PRE_CHORUS: "프리코러스",
  CHORUS: "코러스",
  BRIDGE: "브릿지",
  INTERLUDE: "인터루드",
  OUTRO: "아웃트로",
};

const SECTION_TYPE_COLORS: Record<string, string> = {
  INTRO: "bg-gray-100 text-gray-600",
  VERSE1: "bg-blue-50 text-blue-600", VERSE2: "bg-blue-50 text-blue-600",
  VERSE3: "bg-blue-50 text-blue-600", VERSE4: "bg-blue-50 text-blue-600",
  PRE_CHORUS: "bg-purple-50 text-purple-600",
  CHORUS: "bg-orange-50 text-orange-600",
  BRIDGE: "bg-pink-50 text-pink-600",
  INTERLUDE: "bg-yellow-50 text-yellow-600",
  OUTRO: "bg-gray-100 text-gray-600",
};

function SectionForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: Partial<SongSection>;
  onSubmit: (data: Omit<SongSection, "id" | "song_id">) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    section_type: initial?.section_type ?? "INTRO",
    section_label: initial?.section_label ?? "",
    lyrics: initial?.lyrics ?? "",
    bars: initial?.bars ?? 8,
    chord: initial?.chord ?? "",
    order: initial?.order ?? 0,
  });

  const handleTypeChange = (type: string) => {
    setForm((f) => ({
      ...f,
      section_type: type,
      section_label: f.section_label || SECTION_TYPE_LABELS[type] || type,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, chord: form.chord || null });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">구간 타입</label>
          <select
            value={form.section_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          >
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>{t} — {SECTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">표시 이름</label>
          <input
            value={form.section_label}
            onChange={(e) => setForm({ ...form, section_label: e.target.value })}
            placeholder={SECTION_TYPE_LABELS[form.section_type]}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">마디수</label>
          <input
            type="number"
            min={1}
            value={form.bars}
            onChange={(e) => setForm({ ...form, bars: parseInt(e.target.value) || 8 })}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">코드 진행</label>
          <input
            value={form.chord}
            onChange={(e) => setForm({ ...form, chord: e.target.value })}
            placeholder="예: Am - G - F - C"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">가사 (이 구간)</label>
          <textarea
            rows={3}
            value={form.lyrics}
            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
            placeholder="이 구간에 해당하는 가사를 붙여넣어 주세요"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
        >
          {isPending ? "저장 중..." : "저장"}
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

  const colorClass = SECTION_TYPE_COLORS[section.section_type] ?? "bg-gray-100 text-gray-600";

  if (editing) {
    return (
      <SectionForm
        initial={section}
        onSubmit={(data) =>
          updateSection({ id: section.id, ...data }, { onSuccess: () => setEditing(false) })
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
      className="bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-300 text-sm select-none">⠿</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${colorClass}`}>
          {section.section_type}
        </span>
        <span className="text-sm font-medium text-gray-700 flex-1 truncate">{section.section_label}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{section.bars}마디</span>
        {section.chord && (
          <span className="text-xs text-primary-500 font-mono flex-shrink-0 hidden sm:block">{section.chord}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            {expanded ? "접기" : "가사"}
          </button>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-primary-500 px-1">
            수정
          </button>
          <button
            onClick={() => {
              if (confirm(`"${section.section_label}" 구간을 삭제하시겠습니까?`))
                deleteSection(section.id);
            }}
            className="text-xs text-gray-300 hover:text-red-400 px-1"
          >
            삭제
          </button>
        </div>
      </div>
      {expanded && section.lyrics && (
        <div className="mt-2 ml-7 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-2">
          {section.lyrics}
        </div>
      )}
    </div>
  );
}

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSong, setEditingSong] = useState(false);
  const dragId = useRef<string | null>(null);

  const { data: song, isLoading } = useSongDetail(id);
  const { mutate: updateSong, isPending: isSongUpdating } = useUpdateSong();
  const { mutate: deleteSong } = useDeleteSong();
  const { mutate: addSection, isPending: isAddingSection } = useAddSection(id);
  const { mutate: reorder } = useReorderSections(id);

  const [songForm, setSongForm] = useState<{
    title: string; artist: string; default_key: string; bpm: number; category: string; lyrics: string;
  } | null>(null);

  const handleEditSong = () => {
    if (!song) return;
    setSongForm({
      title: song.title,
      artist: song.artist,
      default_key: song.default_key,
      bpm: song.bpm,
      category: song.category,
      lyrics: song.lyrics,
    });
    setEditingSong(true);
  };

  const handleSaveSong = () => {
    if (!songForm) return;
    updateSong({ id, ...songForm }, { onSuccess: () => setEditingSong(false) });
  };

  const handleDragStart = (sectionId: string) => {
    dragId.current = sectionId;
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
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">찬양을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const sections = [...song.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-2xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/songs")} className="text-sm text-gray-400 hover:text-gray-600">
          ← 찬양 목록
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleEditSong} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            곡 정보 수정
          </button>
          <button
            onClick={() => { if (confirm("이 찬양을 삭제하시겠습니까?")) deleteSong(id, { onSuccess: () => router.push("/songs") }); }}
            className="text-sm text-red-400 hover:text-red-600"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 곡 정보 */}
      {editingSong && songForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 mb-2">곡 정보 수정</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">곡 제목</label>
              <input
                value={songForm.title}
                onChange={(e) => setSongForm({ ...songForm, title: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">아티스트</label>
              <input
                value={songForm.artist}
                onChange={(e) => setSongForm({ ...songForm, artist: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">BPM</label>
              <input
                type="number"
                value={songForm.bpm}
                onChange={(e) => setSongForm({ ...songForm, bpm: parseInt(e.target.value) || 80 })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">가사 전체</label>
              <textarea
                rows={8}
                value={songForm.lyrics}
                onChange={(e) => setSongForm({ ...songForm, lyrics: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingSong(false)} className="px-4 py-2 text-sm text-gray-500">취소</button>
            <button
              onClick={handleSaveSong}
              disabled={isSongUpdating}
              className="px-5 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-40"
            >
              {isSongUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary-900">{song.title}</h1>
              <p className="text-sm text-primary-600 mt-1">{song.artist}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">{song.default_key}</span>
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">{song.bpm} BPM</span>
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">{song.category}</span>
            </div>
          </div>
        </div>
      )}

      {/* 가사 전체 */}
      {!editingSong && song.lyrics && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">가사 전체</h2>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed font-sans">
            {song.lyrics}
          </pre>
          <p className="text-xs text-gray-400 mt-3">
            위 가사에서 각 구간에 해당하는 부분을 복사해서 아래 구간 편집기에 붙여넣으세요.
          </p>
        </div>
      )}

      {/* 구간 구성 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">구간 구성 (송폼)</h2>
            <p className="text-xs text-gray-400 mt-0.5">드래그로 순서를 변경할 수 있습니다</p>
          </div>
          <button
            onClick={() => setShowAddSection(!showAddSection)}
            className="text-sm px-3 py-1.5 border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50"
          >
            {showAddSection ? "취소" : "+ 구간 추가"}
          </button>
        </div>

        {/* 현재 송폼 흐름 */}
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-2 px-3 bg-gray-50 rounded-lg">
            {sections.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                <span className={`text-xs px-1.5 py-0.5 rounded ${SECTION_TYPE_COLORS[s.section_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {s.section_label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 추가 폼 */}
        {showAddSection && (
          <SectionForm
            initial={{ order: sections.length }}
            onSubmit={(data) =>
              addSection(data, { onSuccess: () => setShowAddSection(false) })
            }
            onCancel={() => setShowAddSection(false)}
            isPending={isAddingSection}
          />
        )}

        {/* 구간 목록 */}
        {sections.length === 0 && !showAddSection ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <p>아직 구간이 없습니다.</p>
            <p className="mt-1">위 가사를 참고해서 구간을 추가해 주세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                songId={id}
                onDragStart={handleDragStart}
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
