"use client";

import { useEffect, useState } from "react";
import type { SongRecommendation, Worship, WorshipMentItem } from "@/types";
import { useBatchSaveMents, useRecommendSectionMent, useWorshipMents } from "@/hooks/useWorshipMent";

interface MentEditorProps {
  worship: Worship;
  songs: SongRecommendation[];
  onClose: () => void;
}

function buildDefaultMents(songs: SongRecommendation[]): WorshipMentItem[] {
  const ments: WorshipMentItem[] = [];
  let order = 0;

  songs.forEach((song, songIdx) => {
    const form = song.song_form.length > 0 ? song.song_form : ["Intro", "Chorus", "Outro"];

    // 첫 곡 시작 전 멘트
    if (songIdx === 0) {
      ments.push({
        song_title: song.title,
        section_label: "예배 시작",
        ment_text: "",
        order: order++,
      });
    }

    // 각 섹션 전환 멘트
    form.forEach((section, i) => {
      if (i < form.length - 1) {
        ments.push({
          song_title: song.title,
          section_label: `${section} → ${form[i + 1]}`,
          ment_text: "",
          order: order++,
        });
      }
    });

    // 곡 마무리 / 다음 곡 이어가기
    if (songIdx < songs.length - 1) {
      ments.push({
        song_title: song.title,
        section_label: `곡 마무리 / 다음으로 (${songs[songIdx + 1].title})`,
        ment_text: "",
        order: order++,
      });
    } else {
      ments.push({
        song_title: song.title,
        section_label: "예배 마무리",
        ment_text: "",
        order: order++,
      });
    }
  });

  return ments;
}

interface AiRecommendState {
  idx: number;
  loading: boolean;
  alternatives: string[];
}

export function MentEditor({ worship, songs, onClose }: MentEditorProps) {
  const { data, isLoading } = useWorshipMents(worship.id);
  const { mutate: saveMents, isPending: isSaving } = useBatchSaveMents(worship.id);
  const { mutate: recommendMent } = useRecommendSectionMent();

  const [ments, setMents] = useState<WorshipMentItem[]>([]);
  const [aiState, setAiState] = useState<AiRecommendState | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && data.ments.length > 0) {
      setMents(data.ments);
    } else if (songs.length > 0) {
      setMents(buildDefaultMents(songs));
    }
  }, [data, songs]);

  const handleMentChange = (idx: number, value: string) => {
    setMents((prev) => prev.map((m, i) => (i === idx ? { ...m, ment_text: value } : m)));
    setSaved(false);
  };

  const handleAiRecommend = (idx: number) => {
    const ment = ments[idx];
    const parts = ment.section_label.split(" → ");
    const section_from = parts[0].trim();
    const section_to = parts[1]?.trim() ?? ment.section_label;

    setAiState({ idx, loading: true, alternatives: [] });

    recommendMent(
      {
        song_title: ment.song_title,
        section_from,
        section_to,
        scripture: worship.scripture,
        theme: worship.sermon_direction,
      },
      {
        onSuccess: (res) => {
          setMents((prev) =>
            prev.map((m, i) => (i === idx ? { ...m, ment_text: res.ment } : m))
          );
          setAiState({ idx, loading: false, alternatives: res.alternatives });
          setSaved(false);
        },
        onError: () => setAiState(null),
      }
    );
  };

  const applyAlternative = (idx: number, text: string) => {
    setMents((prev) => prev.map((m, i) => (i === idx ? { ...m, ment_text: text } : m)));
    setAiState(null);
    setSaved(false);
  };

  const handleSave = () => {
    saveMents(ments, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const songGroups = songs.reduce<Record<string, WorshipMentItem[]>>((acc, song) => {
    acc[song.title] = ments.filter((m) => m.song_title === song.title);
    return acc;
  }, {});

  // 예배 시작/마무리 멘트
  const globalMents = ments.filter(
    (m) => !songs.some((s) => s.title === m.song_title)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">멘트 편집</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        각 섹션 전환마다 인도자 멘트를 작성하세요. AI 추천 버튼으로 멘트를 자동 생성할 수 있습니다.
      </p>

      {ments.map((ment, idx) => {
        const isAiTarget = aiState?.idx === idx;
        const isSectionTransition = ment.section_label.includes("→");
        const prevSong = idx > 0 ? ments[idx - 1].song_title : null;
        const showSongHeader = idx === 0 || ment.song_title !== ments[idx - 1].song_title;

        return (
          <div key={idx}>
            {showSongHeader && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-semibold text-gray-500 px-2">
                  {ment.song_title === "예배 마무리" || ment.section_label === "예배 시작"
                    ? ""
                    : ment.song_title}
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
                    onClick={() => handleAiRecommend(idx)}
                    disabled={isAiTarget && aiState?.loading}
                    className="text-xs px-3 py-1 border border-primary-200 text-primary-600 rounded-full hover:bg-primary-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAiTarget && aiState?.loading ? (
                      <>
                        <span className="w-3 h-3 border border-primary-300 border-t-primary-500 rounded-full animate-spin inline-block" />
                        추천 중...
                      </>
                    ) : (
                      "✦ AI 추천"
                    )}
                  </button>
                )}
              </div>

              <textarea
                value={ment.ment_text}
                onChange={(e) => handleMentChange(idx, e.target.value)}
                placeholder={
                  ment.section_label === "예배 시작"
                    ? "예배 시작 전 인사 멘트를 입력하세요..."
                    : ment.section_label === "예배 마무리"
                    ? "마무리 멘트를 입력하세요..."
                    : `'${ment.section_label}' 전환 시 멘트를 입력하세요...`
                }
                rows={2}
                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary-300"
              />

              {/* AI 추천 대안 */}
              {isAiTarget && !aiState?.loading && aiState.alternatives.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">대안 멘트 선택:</p>
                  {aiState.alternatives.map((alt, i) => (
                    <button
                      key={i}
                      onClick={() => applyAlternative(idx, alt)}
                      className="w-full text-left text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 hover:bg-primary-50"
                    >
                      {alt}
                    </button>
                  ))}
                  <button
                    onClick={() => setAiState(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
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
          추천 찬양 목록에서 곡이 있어야 멘트를 작성할 수 있습니다.
        </div>
      )}
    </div>
  );
}
