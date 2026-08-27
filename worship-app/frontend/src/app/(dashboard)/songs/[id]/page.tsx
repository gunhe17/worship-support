"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAddSection,
  useClearSongSheetsByKey,
  useDeleteSection,
  useDeleteSong,
  useDeleteSongSheet,
  useReorderSections,
  useSongDetail,
  useUpdateSection,
  useUpdateSong,
  useUploadSongSheet,
} from "@/hooks/useSong";
import type { SongSection, SongSheet } from "@/types";

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

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];

async function downloadSheet(url: string, songTitle: string, key: string, pageNum?: number) {
  const ext = url.split(".").pop()?.split("?")[0] ?? "jpg";
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = pageNum !== undefined
    ? `${songTitle}_${key}_${pageNum}.${ext}`
    : `${songTitle}_${key}.${ext}`;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function SheetManager({ songId, songTitle, sheets }: { songId: string; songTitle: string; sheets: SongSheet[] }) {
  const [selectedKey, setSelectedKey] = useState("C");
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadSheet, isPending: isUploading } = useUploadSongSheet(songId);
  const { mutate: deleteSheet } = useDeleteSongSheet(songId);
  const { mutate: clearSheets, isPending: isClearing } = useClearSongSheetsByKey(songId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadSheet(
      { key: selectedKey, file },
      {
        onError: (err: any) => {
          const msg =
            err?.response?.data?.detail ??
            err?.response?.data?.message ??
            err?.message ??
            "알 수 없는 오류";
          alert(`악보 업로드 실패\n${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
        },
      }
    );
    e.target.value = "";
  };

  // 선택된 키의 악보만 page_order 순으로 필터
  const keySheets = [...sheets.filter((s) => s.key === selectedKey)].sort(
    (a, b) => a.page_order - b.page_order
  );
  const isMulti = keySheets.length > 1;
  const registeredKeys = new Set(sheets.map((s) => s.key));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">악보 관리</h2>

      {/* 키 선택 + 페이지 추가 */}
      <div className="flex items-center gap-2">
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {k}{registeredKeys.has(k) ? " ✓" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading || isClearing}
          className="flex-1 py-2 px-3 border border-primary-200 text-primary-600 text-sm rounded-lg hover:bg-primary-50 disabled:opacity-40"
        >
          {isUploading
            ? "업로드 중..."
            : keySheets.length === 0
            ? `${selectedKey} 키 악보 추가`
            : `${selectedKey} 키 ${keySheets.length + 1}페이지 추가`}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* 선택된 키의 악보 표시 */}
      {keySheets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{selectedKey} 키 악보가 없습니다.</p>
      ) : (
        <>
          {/* 키 헤더 (전체 삭제) */}
          {keySheets.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{keySheets.length}장</span>
              <button
                onClick={() => {
                  if (confirm(`${selectedKey} 키 악보 ${keySheets.length}장을 모두 삭제할까요?`))
                    clearSheets(keySheets.map((s) => s.id));
                }}
                disabled={isClearing}
                className="text-xs text-gray-300 hover:text-red-400 disabled:opacity-40"
              >
                전체 삭제
              </button>
            </div>
          )}

          {isMulti ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {keySheets.map((s, i) => {
                const isPdf = s.sheet_url.toLowerCase().includes(".pdf");
                return (
                  <div key={s.id} className="flex-none w-72 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                      <span>{i + 1}페이지</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadSheet(s.sheet_url, songTitle, selectedKey, i + 1)}
                          className="hover:text-primary-500"
                        >
                          다운로드
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`${selectedKey} 키 ${i + 1}페이지를 삭제할까요?`)) deleteSheet(s.id);
                          }}
                          className="hover:text-red-400"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    {isPdf ? (
                      <iframe
                        src={s.sheet_url}
                        className="w-full rounded-lg border border-gray-200"
                        style={{ height: 420 }}
                        title={`악보 ${selectedKey} ${i + 1}p`}
                      />
                    ) : (
                      <img
                        src={s.sheet_url}
                        alt={`악보 ${selectedKey} ${i + 1}p`}
                        className="w-full rounded-lg border border-gray-200 object-contain bg-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-end gap-3 text-xs text-gray-400 px-1">
                <button
                  onClick={() => downloadSheet(keySheets[0].sheet_url, songTitle, selectedKey)}
                  className="hover:text-primary-500"
                >
                  다운로드
                </button>
                <button
                  onClick={() => {
                    if (confirm(`${selectedKey} 키 악보를 삭제할까요?`)) deleteSheet(keySheets[0].id);
                  }}
                  className="hover:text-red-400"
                >
                  삭제
                </button>
              </div>
              {keySheets[0].sheet_url.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={keySheets[0].sheet_url}
                  className="w-full rounded-lg border border-gray-200"
                  style={{ height: 500 }}
                  title={`악보 ${selectedKey}`}
                />
              ) : (
                <img
                  src={keySheets[0].sheet_url}
                  alt={`악보 ${selectedKey}`}
                  className="w-full rounded-lg border border-gray-200 object-contain bg-white"
                />
              )}
            </div>
          )}
        </>
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
      <div className="flex items-center">
        <button
          onClick={() => router.push("/songs")}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          ← 찬양 목록
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

      {/* 악보 관리 */}
      <SheetManager songId={id} songTitle={song.title} sheets={song.sheets ?? []} />

      {/* 저장 / 삭제 */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 py-3 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-40 transition-colors"
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={() => {
            if (confirm("이 찬양을 삭제할까요?"))
              deleteSong(id, { onSuccess: () => router.push("/songs") });
          }}
          className="px-6 py-3 border border-red-200 text-red-400 text-sm rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
