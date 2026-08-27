"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  useAddArrangement,
  useArrangements,
  useDeleteArrangement,
  useDeleteWorship,
  useUpdateArrangement,
  useUpdateWorship,
  useUploadSheet,
  useWorshipDetail,
} from "@/hooks/useWorship";
import { useSongDetail, useSongSearch } from "@/hooks/useSong";
import type { Arrangement } from "@/types";

const SECTION_COLORS: Record<string, string> = {
  INTRO: "bg-gray-100 text-gray-500",
  VERSE1: "bg-blue-50 text-blue-600",
  VERSE2: "bg-blue-50 text-blue-600",
  VERSE3: "bg-blue-50 text-blue-600",
  VERSE4: "bg-blue-50 text-blue-600",
  PRE_CHORUS: "bg-purple-50 text-purple-600",
  CHORUS: "bg-orange-50 text-orange-600",
  BRIDGE: "bg-pink-50 text-pink-600",
  INTERLUDE: "bg-yellow-50 text-yellow-600",
  OUTRO: "bg-gray-100 text-gray-500",
};

// ── 곡 상세 드로어 ─────────────────────────────────────────────────────────────
function SongDetailDrawer({ songId, onClose }: { songId: string; onClose: () => void }) {
  const { data: song, isLoading } = useSongDetail(songId);
  const [expandedLyrics, setExpandedLyrics] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 truncate pr-4">
            {isLoading ? "불러오는 중..." : (song?.title ?? "알 수 없는 곡")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">
            ×
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          </div>
        )}

        {song && (
          <div className="p-5 space-y-5">
            {/* 기본 정보 */}
            <div className="flex items-center gap-2 flex-wrap">
              {song.artist && song.artist !== "미상" && (
                <span className="text-sm text-gray-500">{song.artist}</span>
              )}
              {song.bpm > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  BPM {song.bpm}
                </span>
              )}
              {song.default_key && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Key {song.default_key}
                </span>
              )}
            </div>

            {/* 전체 가사 토글 */}
            {song.lyrics && (
              <div className="space-y-2">
                <button
                  onClick={() => setExpandedLyrics(!expandedLyrics)}
                  className="text-xs font-medium text-gray-500 hover:text-primary-500 flex items-center gap-1"
                >
                  가사 전체 {expandedLyrics ? "▲" : "▼"}
                </button>
                {expandedLyrics && (
                  <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                    {song.lyrics}
                  </div>
                )}
              </div>
            )}

            {/* 구간 구성 */}
            {song.sections && song.sections.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500">구간 구성</p>
                {/* 흐름 요약 */}
                <div className="flex flex-wrap gap-1 py-2 px-3 bg-gray-50 rounded-lg">
                  {[...song.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            SECTION_COLORS[s.section_type] ?? "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.section_label}
                        </span>
                      </span>
                    ))}
                </div>
                {/* 구간별 가사 */}
                <div className="space-y-2">
                  {[...song.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <div key={s.id} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedSection(expandedSection === s.id ? null : s.id)
                          }
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              SECTION_COLORS[s.section_type] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {s.section_type}
                          </span>
                          <span className="text-sm text-gray-600 flex-1">{s.section_label}</span>
                          {s.lyrics && (
                            <span className="text-xs text-gray-400 shrink-0">
                              {expandedSection === s.id ? "접기" : "가사"}
                            </span>
                          )}
                        </button>
                        {expandedSection === s.id && s.lyrics && (
                          <div className="px-3 pb-3 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-2.5 bg-gray-50">
                            {s.lyrics}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {song.sections.length === 0 && !song.lyrics && (
              <p className="text-sm text-gray-400 text-center py-8">
                등록된 가사와 구간 정보가 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── 악보 업로드 버튼 ───────────────────────────────────────────────────────────
function SheetUpload({ arr, worshipId }: { arr: Arrangement; worshipId: string }) {
  const { mutate: upload, isPending } = useUploadSheet(worshipId);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload({ arrId: arr.id, file });
    e.target.value = "";
  }

  // manual override takes precedence; fall back to key-matched song sheet
  const displayUrl = arr.sheet_url || arr.song_sheet_url;

  if (displayUrl) {
    return (
      <div className="flex items-center gap-2">
        {arr.song_key && !arr.sheet_url && (
          <span className="text-xs bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded-full font-bold">
            {arr.song_key}
          </span>
        )}
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary-500 hover:underline"
        >
          📄 악보
        </a>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          교체
        </button>
        <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <label className={`text-xs text-gray-400 hover:text-primary-500 cursor-pointer ${isPending ? "opacity-50" : ""}`}>
      {isPending ? "업로드 중..." : "📎 악보"}
      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFile} disabled={isPending} />
    </label>
  );
}

// ── 섹션 선택 토글 ─────────────────────────────────────────────────────────────
function SectionPicker({
  arr,
  worshipId,
}: {
  arr: Arrangement;
  worshipId: string;
}) {
  const { mutate: updateArr } = useUpdateArrangement(worshipId);

  function toggle(sectionType: string) {
    const current = arr.song_form;
    const next = current.includes(sectionType)
      ? current.filter((s) => s !== sectionType)
      : [...current, sectionType];
    updateArr({ id: arr.id, song_form: next });
  }

  if (arr.sections.length === 0) {
    return <p className="text-xs text-gray-300">섹션 없음</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {arr.sections.map((s) => {
        const active = arr.song_form.includes(s.section_type);
        return (
          <button
            key={s.id}
            onClick={() => toggle(s.section_type)}
            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
              active
                ? "bg-primary-100 text-primary-700 font-medium"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
          >
            {s.section_label || s.section_type}
          </button>
        );
      })}
    </div>
  );
}

// ── 콘티 카드 ─────────────────────────────────────────────────────────────────
function ArrangementCard({
  arr,
  index,
  worshipId,
}: {
  arr: Arrangement;
  index: number;
  worshipId: string;
}) {
  const { mutate: deleteArr } = useDeleteArrangement(worshipId);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className="bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-200 cursor-pointer transition-colors"
        onClick={() => setShowDetail(true)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}.</span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">
                  {arr.song_title || "알 수 없는 곡"}
                </span>
                {arr.song_artist && (
                  <span className="text-xs text-gray-400 ml-2">{arr.song_artist}</span>
                )}
              </div>
            </div>
            <div
              className="flex items-center gap-2 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <SheetUpload arr={arr} worshipId={worshipId} />
              <button
                onClick={() => deleteArr(arr.id)}
                className="text-xs text-gray-300 hover:text-red-400"
              >
                삭제
              </button>
            </div>
          </div>
          <div className="ml-7 mt-1" onClick={(e) => e.stopPropagation()}>
            <SectionPicker arr={arr} worshipId={worshipId} />
          </div>
        </div>
      </div>

      {showDetail && (
        <SongDetailDrawer songId={arr.song_id} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

// ── 찬양 검색 & 추가 ───────────────────────────────────────────────────────────
function SongSearchAdd({ worshipId, currentCount }: { worshipId: string; currentCount: number }) {
  const [query, setQuery] = useState("");
  const { data: results } = useSongSearch(query);
  const { mutate: addArr, isPending } = useAddArrangement(worshipId);

  function handleAdd(songId: string) {
    addArr({ song_id: songId, order: currentCount, song_form: [], ment: "" });
    setQuery("");
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="찬양 제목 검색..."
        className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-solid"
      />
      {query.trim() && results && results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((song) => (
            <button
              key={song.id}
              onClick={() => handleAdd(song.id)}
              disabled={isPending}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-primary-50 text-left disabled:opacity-50 border-b border-gray-100 last:border-0"
            >
              <span className="font-medium text-gray-800">{song.title}</span>
              <span className="text-gray-400 text-xs">{song.artist}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && results && results.length === 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
          검색 결과가 없습니다.{" "}
          <Link href="/songs" className="text-primary-500 hover:underline">
            찬양 관리에서 추가하세요
          </Link>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function WorshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: worship, isLoading } = useWorshipDetail(id);
  const { data: arrangements } = useArrangements(id);
  const { mutate: deleteWorship } = useDeleteWorship();
  const { mutate: updateWorship } = useUpdateWorship();

  const [meditation, setMeditation] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSaveMeditation() {
    if (meditation === null) return;
    updateWorship(
      { id, leader_meditation: meditation },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } }
    );
  }

  if (isLoading || !worship) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">{isLoading ? "불러오는 중..." : "예배를 찾을 수 없습니다."}</p>
      </div>
    );
  }

  const currentMeditation = meditation ?? worship.leader_meditation;

  return (
    <div className="max-w-2xl space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/worship")} className="text-sm text-gray-400 hover:text-gray-600">
          ← 목록으로
        </button>
        <div className="flex items-center gap-3">
          <Link
            href={`/worship/${id}/lead`}
            className="text-sm px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
          >
            인도 모드
          </Link>
          <button
            onClick={() => {
              if (confirm("이 예배를 삭제하시겠습니까?")) {
                deleteWorship(id, { onSuccess: () => router.push("/worship") });
              }
            }}
            className="text-sm text-red-400 hover:text-red-600"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 예배 정보 */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 space-y-1">
        {worship.scripture && (
          <p className="text-xs text-primary-500 font-medium">{worship.scripture}</p>
        )}
        <h1 className="text-xl font-bold text-primary-900">{worship.title}</h1>
        {worship.sermon_direction && (
          <p className="text-sm text-primary-600 pt-1">{worship.sermon_direction}</p>
        )}
        <p className="text-xs text-primary-300 pt-1">
          {new Date(worship.created_at).toLocaleDateString("ko-KR")} · {worship.duration_minutes}분
        </p>
      </div>

      {/* 인도자의 묵상 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">인도자의 묵상</h2>
        <textarea
          value={currentMeditation}
          onChange={(e) => setMeditation(e.target.value)}
          placeholder="말씀을 통해 받은 은혜, 예배 방향성, 인도 노트 등을 자유롭게 기록하세요."
          rows={5}
          className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-300"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSaveMeditation}
            disabled={meditation === null}
            className="text-sm px-4 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-30 transition-colors"
          >
            {saved ? "저장됨 ✓" : "저장"}
          </button>
        </div>
      </div>

      {/* 콘티 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">
          콘티 {arrangements && arrangements.length > 0 ? `(${arrangements.length}곡)` : ""}
        </h2>

        {arrangements && arrangements.length > 0 && (
          <div className="space-y-2">
            {arrangements.map((arr, i) => (
              <ArrangementCard key={arr.id} arr={arr} index={i} worshipId={id} />
            ))}
          </div>
        )}

        <SongSearchAdd worshipId={id} currentCount={arrangements?.length ?? 0} />
      </div>
    </div>
  );
}
