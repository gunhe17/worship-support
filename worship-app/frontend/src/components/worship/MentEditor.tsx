"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { SongFormSection, SongRecommendation, Worship, WorshipMentItem } from "@/types";
import { Teleprompter } from "./Teleprompter";
import {
  useBatchSaveMents,
  useRecommendSectionMent,
  useRecommendSongFormWithBars,
  useWorshipMents,
} from "@/hooks/useWorshipMent";

interface MentEditorProps {
  worship: Worship;
  songs: SongRecommendation[];
  onClose: () => void;
}

// 기본 마디 수 (섹션 이름별)
const DEFAULT_BARS: Record<string, number> = {
  Intro: 8, Verse: 16, Verse1: 16, Verse2: 16, Verse3: 16,
  "Pre-Chorus": 8, PreChorus: 8, Chorus: 16, Bridge: 16,
  Tag: 8, Inter: 8, Outro: 8, Ending: 8,
};

function getDefaultBars(sectionName: string): number {
  return DEFAULT_BARS[sectionName] ?? 8;
}

function initSongForms(songs: SongRecommendation[]): Record<string, SongFormSection[]> {
  const forms: Record<string, SongFormSection[]> = {};
  songs.forEach((song) => {
    const base = song.song_form.length > 0 ? song.song_form : ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
    forms[song.title] = base.map((name) => ({ name, bars: getDefaultBars(name) }));
  });
  return forms;
}

function buildMentsFromForms(
  songs: SongRecommendation[],
  songForms: Record<string, SongFormSection[]>
): WorshipMentItem[] {
  const ments: WorshipMentItem[] = [];
  let order = 0;

  songs.forEach((song, songIdx) => {
    const form = songForms[song.title] ?? [{ name: "Chorus", bars: 16 }];

    if (songIdx === 0) {
      ments.push({ song_title: song.title, section_label: "예배 시작", ment_text: "", order: order++ });
    }

    form.forEach((section, i) => {
      if (i < form.length - 1) {
        ments.push({
          song_title: song.title,
          section_label: `${section.name}(${section.bars}마디) → ${form[i + 1].name}(${form[i + 1].bars}마디)`,
          ment_text: "",
          order: order++,
        });
      }
    });

    if (songIdx < songs.length - 1) {
      ments.push({
        song_title: song.title,
        section_label: `곡 마무리 → ${songs[songIdx + 1].title}`,
        ment_text: "",
        order: order++,
      });
    } else {
      ments.push({ song_title: song.title, section_label: "예배 마무리", ment_text: "", order: order++ });
    }
  });

  return ments;
}

// 섹션 레이블에서 마디 수 추출
function parseBarsFromLabel(label: string): { from: number; to: number } {
  const matches = [...label.matchAll(/\((\d+)마디\)/g)];
  return { from: Number(matches[0]?.[1] ?? 8), to: Number(matches[1]?.[1] ?? 8) };
}

// 섹션 이름만 추출 (마디 수 제거)
function parseSectionNames(label: string): { from: string; to: string } {
  const parts = label.split(" → ");
  const from = parts[0]?.replace(/\(\d+마디\)/, "").trim() ?? "";
  const to = parts[1]?.replace(/\(\d+마디\)/, "").trim() ?? label;
  return { from, to };
}

type Step = "form" | "ment";

interface AiMentState { idx: number; loading: boolean; alternatives: string[] }
interface AiFormState { songTitle: string; loading: boolean }

export function MentEditor({ worship, songs, onClose }: MentEditorProps) {
  const { data: savedData, isLoading: isFetching } = useWorshipMents(worship.id);
  const { mutate: saveMents, isPending: isSaving } = useBatchSaveMents(worship.id);
  const { mutate: recommendMent } = useRecommendSectionMent();
  const { mutate: recommendForm } = useRecommendSongFormWithBars();

  const [step, setStep] = useState<Step>("form");
  const [songForms, setSongForms] = useState<Record<string, SongFormSection[]>>({});
  const [ments, setMents] = useState<WorshipMentItem[]>([]);
  const [aiMentState, setAiMentState] = useState<AiMentState | null>(null);
  const [aiFormState, setAiFormState] = useState<AiFormState | null>(null);
  const [saved, setSaved] = useState(false);
  const [showLead, setShowLead] = useState(false);

  // 드래그 앤 드롭 상태
  const dragInfo = useRef<{ songTitle: string; fromIdx: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<{ songTitle: string; toIdx: number } | null>(null);

  useEffect(() => {
    if (songs.length > 0) {
      setSongForms(initSongForms(songs));
    }
  }, [songs]);

  useEffect(() => {
    if (savedData && savedData.ments.length > 0 && songs.length > 0) {
      setMents(savedData.ments);
    }
  }, [savedData, songs]);

  // 송폼 편집 시 ment 목록 동기화
  const syncMents = (forms: Record<string, SongFormSection[]>) => {
    const newMents = buildMentsFromForms(songs, forms);
    // 기존 ment_text 유지
    const textMap: Record<string, string> = {};
    ments.forEach((m) => { textMap[`${m.song_title}__${m.section_label}`] = m.ment_text; });
    newMents.forEach((m) => {
      m.ment_text = textMap[`${m.song_title}__${m.section_label}`] ?? "";
    });
    setMents(newMents);
  };

  const handleSectionNameChange = (songTitle: string, idx: number, name: string) => {
    setSongForms((prev) => {
      const updated = { ...prev, [songTitle]: prev[songTitle].map((s, i) => i === idx ? { ...s, name } : s) };
      syncMents(updated);
      return updated;
    });
  };

  const handleBarsChange = (songTitle: string, idx: number, bars: number) => {
    setSongForms((prev) => {
      const updated = { ...prev, [songTitle]: prev[songTitle].map((s, i) => i === idx ? { ...s, bars } : s) };
      syncMents(updated);
      return updated;
    });
  };

  const addSection = (songTitle: string) => {
    setSongForms((prev) => {
      const updated = { ...prev, [songTitle]: [...prev[songTitle], { name: "Tag", bars: 8 }] };
      syncMents(updated);
      return updated;
    });
  };

  const removeSection = (songTitle: string, idx: number) => {
    setSongForms((prev) => {
      const updated = { ...prev, [songTitle]: prev[songTitle].filter((_, i) => i !== idx) };
      syncMents(updated);
      return updated;
    });
  };

  const reorderSections = (songTitle: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setSongForms((prev) => {
      const sections = [...prev[songTitle]];
      const [moved] = sections.splice(fromIdx, 1);
      sections.splice(toIdx, 0, moved);
      const updated = { ...prev, [songTitle]: sections };
      syncMents(updated);
      return updated;
    });
  };

  const handleAiFormRecommend = (song: SongRecommendation) => {
    const totalPerSong = Math.round((worship.duration_minutes ?? 30) * 0.7 / songs.length * 10) / 10;
    setAiFormState({ songTitle: song.title, loading: true });
    recommendForm(
      { song_title: song.title, artist: song.artist, bpm: song.bpm || 90, available_minutes: totalPerSong },
      {
        onSuccess: (res) => {
          setSongForms((prev) => {
            const updated = { ...prev, [song.title]: res.sections };
            syncMents(updated);
            return updated;
          });
          setAiFormState({ songTitle: song.title, loading: false });
        },
        onError: () => setAiFormState(null),
      }
    );
  };

  const handleAiMentRecommend = (idx: number) => {
    const ment = ments[idx];
    const { from, to } = parseSectionNames(ment.section_label);
    const { from: barsFrom, to: barsTo } = parseBarsFromLabel(ment.section_label);
    setAiMentState({ idx, loading: true, alternatives: [] });
    recommendMent(
      {
        song_title: ment.song_title,
        section_from: from,
        section_to: to,
        bars_from: barsFrom,
        bars_to: barsTo,
        scripture: worship.scripture,
        theme: worship.sermon_direction,
      },
      {
        onSuccess: (res) => {
          setMents((prev) => prev.map((m, i) => i === idx ? { ...m, ment_text: res.ment } : m));
          setAiMentState({ idx, loading: false, alternatives: res.alternatives });
          setSaved(false);
        },
        onError: () => setAiMentState(null),
      }
    );
  };

  const applyAlternative = (idx: number, text: string) => {
    setMents((prev) => prev.map((m, i) => i === idx ? { ...m, ment_text: text } : m));
    setAiMentState(null);
    setSaved(false);
  };

  const handleMentChange = (idx: number, value: string) => {
    setMents((prev) => prev.map((m, i) => i === idx ? { ...m, ment_text: value } : m));
    setSaved(false);
  };

  const handleSave = () => {
    saveMents(ments, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    });
  };

  const goToMentStep = () => {
    const built = buildMentsFromForms(songs, songForms);
    const textMap: Record<string, string> = {};
    ments.forEach((m) => { textMap[`${m.song_title}__${m.section_label}`] = m.ment_text; });
    built.forEach((m) => { m.ment_text = textMap[`${m.song_title}__${m.section_label}`] ?? ""; });
    setMents(built);
    setStep("ment");
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (showLead) {
    return <Teleprompter ments={ments} songs={songs} onExit={() => setShowLead(false)} />;
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setStep("form")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${step === "form" ? "bg-white text-gray-800 shadow-sm font-medium" : "text-gray-500"}`}
          >
            1단계 · 송폼
          </button>
          <button
            onClick={goToMentStep}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${step === "ment" ? "bg-white text-gray-800 shadow-sm font-medium" : "text-gray-500"}`}
          >
            2단계 · 멘트
          </button>
        </div>
        <div className="flex gap-2">
          {step === "ment" && (
            <>
              <button
                onClick={() => setShowLead(true)}
                disabled={!!aiMentState?.loading || !!aiFormState?.loading || isFetching}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {aiMentState?.loading || aiFormState?.loading ? "AI 분석 중..." : "🎤 예배 인도 모드"}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {isSaving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>

      {/* ── 1단계: 송폼 편집 ── */}
      {step === "form" && (
        <div className="space-y-6">
          <p className="text-xs text-gray-400">
            각 찬양의 섹션과 마디 수를 설정하세요. AI 추천으로 예배 시간에 맞게 자동 배분할 수 있습니다.
          </p>

          {songs.map((song) => {
            const form = songForms[song.title] ?? [];
            const isAiLoading = aiFormState?.songTitle === song.title && aiFormState.loading;
            const totalBars = form.reduce((sum, s) => sum + s.bars, 0);
            const estMin = song.bpm > 0
              ? Math.round((totalBars * 4 / (song.bpm || 90) * 60) / 6) / 10
              : 0;

            return (
              <div key={song.title} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{song.title}</p>
                    <p className="text-xs text-gray-400">
                      {song.artist} · {song.recommended_key} · {song.bpm}BPM
                      {estMin > 0 && ` · 약 ${estMin}분`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAiFormRecommend(song)}
                    disabled={isAiLoading}
                    className="text-xs px-3 py-1.5 border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAiLoading ? (
                      <><span className="w-3 h-3 border border-t-primary-500 rounded-full animate-spin" />추천 중...</>
                    ) : "✦ AI 송폼 추천"}
                  </button>
                </div>

                {/* 섹션 목록 */}
                <div className="space-y-1">
                  {form.map((section, i) => {
                    const isDragging = dragInfo.current?.songTitle === song.title && dragInfo.current.fromIdx === i;
                    const isDropTarget = dragOverKey?.songTitle === song.title && dragOverKey.toIdx === i && dragInfo.current?.fromIdx !== i;
                    return (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => { dragInfo.current = { songTitle: song.title, fromIdx: i }; }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragInfo.current?.songTitle === song.title) {
                            setDragOverKey({ songTitle: song.title, toIdx: i });
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragInfo.current?.songTitle === song.title) {
                            reorderSections(song.title, dragInfo.current.fromIdx, i);
                            dragInfo.current = null;
                          }
                          setDragOverKey(null);
                        }}
                        onDragEnd={() => { dragInfo.current = null; setDragOverKey(null); }}
                        className={`flex items-center gap-2 rounded-lg px-1 py-0.5 transition-all ${
                          isDragging ? "opacity-40" : ""
                        } ${isDropTarget ? "border-t-2 border-primary-400 pt-2" : ""}`}
                      >
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
                        <span className="text-xs text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => handleSectionNameChange(song.title, i, e.target.value)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleBarsChange(song.title, i, Math.max(1, section.bars - 1))}
                            className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm flex items-center justify-center"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            value={section.bars}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              if (!isNaN(v) && v >= 1) handleBarsChange(song.title, i, v);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="text-sm font-mono w-10 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => handleBarsChange(song.title, i, section.bars + 1)}
                            className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm flex items-center justify-center"
                          >+</button>
                          <span className="text-xs text-gray-400 ml-1">마디</span>
                        </div>
                        <button
                          onClick={() => removeSection(song.title, i)}
                          className="text-gray-300 hover:text-red-400 text-xs px-1 shrink-0"
                        >✕</button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => addSection(song.title)}
                  className="w-full py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:text-primary-500"
                >
                  + 섹션 추가
                </button>
              </div>
            );
          })}

          <button
            onClick={goToMentStep}
            className="w-full py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600"
          >
            2단계 · 멘트 작성으로 →
          </button>
        </div>
      )}

      {/* ── 2단계: 멘트 편집 ── */}
      {step === "ment" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            섹션 전환마다 인도 멘트를 작성하세요. AI 추천은 마디 수와 본문을 반영합니다.
          </p>

          {ments.map((ment, idx) => {
            const isAiTarget = aiMentState?.idx === idx;
            const isSectionTransition = ment.section_label.includes("→") && ment.section_label !== "예배 시작" && ment.section_label !== "예배 마무리";
            const showSongHeader = idx === 0 || ment.song_title !== ments[idx - 1].song_title;

            return (
              <div key={idx}>
                {showSongHeader && (
                  <div className="flex items-center gap-2 mt-2 mb-1">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs font-semibold text-gray-500 px-2 shrink-0">
                      {ment.section_label === "예배 시작" ? "예배 시작" : ment.song_title}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      {ment.section_label}
                    </span>
                    {isSectionTransition && (
                      <button
                        onClick={() => handleAiMentRecommend(idx)}
                        disabled={isAiTarget && !!aiMentState?.loading}
                        className="text-xs px-3 py-1 border border-primary-200 text-primary-600 rounded-full hover:bg-primary-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isAiTarget && aiMentState?.loading ? (
                          <><span className="w-3 h-3 border border-t-primary-500 rounded-full animate-spin inline-block" />추천 중...</>
                        ) : "✦ AI 추천"}
                      </button>
                    )}
                  </div>

                  <textarea
                    value={ment.ment_text}
                    onChange={(e) => handleMentChange(idx, e.target.value)}
                    placeholder={
                      ment.section_label === "예배 시작" ? "예배 시작 멘트..." :
                      ment.section_label === "예배 마무리" ? "마무리 멘트..." :
                      `'${ment.section_label}' 전환 시 멘트...`
                    }
                    rows={2}
                    className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary-300"
                  />

                  {isAiTarget && !aiMentState?.loading && (aiMentState?.alternatives ?? []).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400">대안 멘트:</p>
                      {aiMentState!.alternatives.map((alt, i) => (
                        <button
                          key={i}
                          onClick={() => applyAlternative(idx, alt)}
                          className="w-full text-left text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 hover:bg-primary-50"
                        >
                          {alt}
                        </button>
                      ))}
                      <button onClick={() => setAiMentState(null)} className="text-xs text-gray-400 hover:text-gray-600">
                        닫기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {ments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              1단계에서 송폼을 먼저 설정해주세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
