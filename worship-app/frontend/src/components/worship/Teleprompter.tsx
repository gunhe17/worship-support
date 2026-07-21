"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SongRecommendation, WorshipMentItem } from "@/types";

interface TeleprompterProps {
  ments: WorshipMentItem[];
  songs: SongRecommendation[];
  onExit: () => void;
}

interface MentTrigger {
  mentIndex: number;
  triggerAt: number;
}

interface SongSpan {
  title: string;
  startSec: number;
  durationSec: number;
}

const DEFAULT_BARS: Record<string, number> = {
  Intro: 8, Verse: 16, Verse1: 16, Verse2: 16, Verse3: 16,
  "Pre-Chorus": 8, PreChorus: 8, Chorus: 16, Bridge: 16,
  Tag: 8, Inter: 8, Outro: 8, Ending: 8,
};

function parseSectionBars(label: string): Record<string, number> {
  const map: Record<string, number> = {};
  const re = /([A-Za-z가-힣][A-Za-z가-힣0-9 ]*?)\s*\((\d+)마디\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(label)) !== null) map[m[1].trim()] = parseInt(m[2]);
  return map;
}

function toSectionName(label: string): string {
  const after = label.includes("→") ? label.split("→")[1] : label;
  return after.replace(/\(\d+마디\)/g, "").trim();
}

function formatLabel(label: string): string {
  return label.replace(/\(\d+마디\)/g, "").replace(/\s+/g, " ").trim();
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildTimeline(ments: WorshipMentItem[], songs: SongRecommendation[]): {
  triggers: MentTrigger[];
  songSpans: SongSpan[];
  totalSec: number;
} {
  const songMap = new Map(songs.map((s) => [s.title, s]));
  const songTitles = ments.reduce<string[]>((acc, m) => {
    if (!acc.includes(m.song_title)) acc.push(m.song_title);
    return acc;
  }, []);

  const triggers: MentTrigger[] = [];
  const songSpans: SongSpan[] = [];
  let songStartSec = 0;

  for (const title of songTitles) {
    const song = songMap.get(title);
    const bpm = song?.bpm && song.bpm > 0 ? song.bpm : 80;
    const secsPerBar = (60 / bpm) * 4;
    const songForm = song?.song_form ?? [];
    const songDurationSec = (song?.estimated_duration_minutes ?? 4) * 60;

    const songMentEntries = ments.map((m, i) => ({ m, i })).filter(({ m }) => m.song_title === title);

    const barsMap: Record<string, number> = {};
    for (const { m } of songMentEntries) Object.assign(barsMap, parseSectionBars(m.section_label));

    const sectionStartSecs: Record<string, number> = {};
    let cumSecs = 0;
    for (const name of songForm) {
      sectionStartSecs[name] = cumSecs;
      cumSecs += (barsMap[name] ?? DEFAULT_BARS[name] ?? 8) * secsPerBar;
    }

    songMentEntries.forEach(({ m, i }, j) => {
      const toSection = toSectionName(m.section_label);
      const fromSecs = sectionStartSecs[toSection];
      const offsetSec = fromSecs !== undefined
        ? fromSecs
        : songDurationSec * (j / Math.max(songMentEntries.length, 1));
      triggers.push({ mentIndex: i, triggerAt: songStartSec + offsetSec });
    });

    const thisDuration = cumSecs > 0 ? cumSecs : songDurationSec;
    songSpans.push({ title, startSec: songStartSec, durationSec: thisDuration });
    songStartSec += thisDuration;
  }

  return { triggers, songSpans, totalSec: songStartSec };
}

export function Teleprompter({ ments, songs, onExit }: TeleprompterProps) {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const elapsedRef = useRef(0);
  const currentRef = useRef(0);
  const timelineRef = useRef<MentTrigger[]>([]);
  const songSpansRef = useRef<SongSpan[]>([]);
  const totalSecRef = useRef(0);
  const mentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // current 동기화
  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    const { triggers, songSpans, totalSec } = buildTimeline(ments, songs);
    timelineRef.current = triggers;
    songSpansRef.current = songSpans;
    totalSecRef.current = totalSec;
  }, [ments, songs]);

  // 활성 멘트가 바뀌면 스크롤해서 화면 중앙에 보이게
  useEffect(() => {
    mentRefs.current[current]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current]);

  const jumpTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, ments.length - 1));
    currentRef.current = clamped;
    setCurrent(clamped);
    const trigger = timelineRef.current.find((t) => t.mentIndex === clamped);
    if (trigger) {
      elapsedRef.current = trigger.triggerAt;
      setElapsed(trigger.triggerAt);
    }
  }, [ments.length]);

  // 자동 타이머
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      elapsedRef.current += 0.5;
      setElapsed(elapsedRef.current);
      const due = timelineRef.current.filter(
        (t) => t.mentIndex > currentRef.current && t.triggerAt <= elapsedRef.current,
      );
      if (due.length > 0) {
        const next = due[due.length - 1];
        currentRef.current = next.mentIndex;
        setCurrent(next.mentIndex);
      }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  // 키보드
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); jumpTo(currentRef.current + 1); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); jumpTo(currentRef.current - 1); }
      else if (e.key === " ") { e.preventDefault(); setIsPlaying((p) => !p); }
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [jumpTo, onExit]);

  const currentMent = ments[current];
  const currentSongTitle = currentMent?.song_title ?? "";
  const currentSong = songs.find((s) => s.title === currentSongTitle);
  const activeSectionName = currentMent ? toSectionName(currentMent.section_label) : "";
  const activeSectionIdx = currentSong?.song_form.findIndex(
    (f) => f.toLowerCase() === activeSectionName.toLowerCase(),
  ) ?? -1;

  const songOrder = ments.reduce<string[]>((acc, m) => {
    if (!acc.includes(m.song_title)) acc.push(m.song_title);
    return acc;
  }, []);
  const currentSongIdx = songOrder.indexOf(currentSongTitle);

  const totalSec = totalSecRef.current;
  const progressPct = totalSec > 0 ? Math.min((elapsed / totalSec) * 100, 100) : 0;

  // 현재 곡 내 경과 시간 / 곡 전체 시간
  const currentSongSpan = songSpansRef.current.find((s) => s.title === currentSongTitle);
  const songElapsed = currentSongSpan ? Math.max(0, elapsed - currentSongSpan.startSec) : 0;
  const songDuration = currentSongSpan?.durationSec ?? 0;
  const songProgressPct = songDuration > 0 ? Math.min((songElapsed / songDuration) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 bg-black flex select-none">

      {/* ── 왼쪽: 악보 영역 (3/4) ── */}
      <div className="flex-1 border-r border-white/5 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <p className="text-white/15 text-sm font-light">악보 영역</p>
        </div>
      </div>

      {/* ── 오른쪽: 인도 패널 (1/4) ── */}
      <div className="w-80 flex flex-col bg-black">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-bold tracking-[0.2em] uppercase">Live</span>
          </div>
          <button onClick={onExit} className="text-white/20 hover:text-white/50 text-[10px] tracking-widest transition-colors">
            ESC
          </button>
        </div>

        {/* 현재 곡 정보 */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <p className="text-white/25 text-[10px] mb-1">
            {currentSongIdx + 1} / {songOrder.length}번째 찬양
          </p>
          <h2 className="text-white text-lg font-semibold leading-tight">{currentSongTitle}</h2>
          {currentSong?.artist && (
            <p className="text-white/25 text-xs mt-0.5">{currentSong.artist}</p>
          )}

          {/* 송폼 칩 */}
          {currentSong?.song_form && currentSong.song_form.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {currentSong.song_form.map((form, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-300 ${
                  i === activeSectionIdx
                    ? "bg-white text-black"
                    : i < activeSectionIdx
                    ? "bg-white/6 text-white/18 line-through"
                    : "bg-white/5 text-white/25"
                }`}>
                  {form}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mx-5 border-t border-white/6 shrink-0" />

        {/* ── 멘트 목록 (스크롤 가능) ── */}
        <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "none" }}>
          {songOrder.map((title, songIdx) => {
            const songMents = ments
              .map((m, i) => ({ m, i }))
              .filter(({ m }) => m.song_title === title);

            return (
              <div key={title}>
                {/* 곡 구분선 (2번째 곡부터) */}
                {songIdx > 0 && (
                  <div className="flex items-center gap-2 px-5 py-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-white/18 text-[9px] tracking-wider">{title}</span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                )}

                {songMents.map(({ m, i }) => {
                  const isActive = i === current;
                  const isPast = i < current;

                  // 이 멘트가 발동되는 시간 (곡 내 상대 시간)
                  const globalTriggerAt = timelineRef.current.find((t) => t.mentIndex === i)?.triggerAt ?? 0;
                  const songSpan = songSpansRef.current.find((s) => s.title === m.song_title);
                  const relTriggerAt = globalTriggerAt - (songSpan?.startSec ?? 0);

                  return (
                    <div
                      key={i}
                      ref={(el) => { mentRefs.current[i] = el; }}
                      onClick={() => jumpTo(i)}
                      className={`mx-3 mb-1 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-white/8 border border-white/10"
                          : "hover:bg-white/4 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className={`text-[9px] uppercase tracking-[0.15em] transition-colors ${
                          isActive ? "text-white/40" : "text-white/12"
                        }`}>
                          {formatLabel(m.section_label)}
                        </p>
                        <span className={`text-[10px] tabular-nums font-mono transition-colors ${
                          isActive ? "text-white/50" : isPast ? "text-white/15" : "text-white/20"
                        }`}>
                          {formatTime(relTriggerAt)}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed transition-colors ${
                        isActive
                          ? "text-white font-medium"
                          : isPast
                          ? "text-white/18"
                          : "text-white/38"
                      }`}>
                        {m.ment_text || <span className="italic text-white/15">멘트 없음</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 하단 여백 (마지막 멘트가 중앙에 올 수 있도록) */}
          <div className="h-24" />
        </div>

        {/* ── 재생 컨트롤 ── */}
        <div className="px-5 pb-5 pt-3 border-t border-white/5 space-y-3 shrink-0">

          {/* 현재 곡 시간 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-white text-base font-semibold tabular-nums">
                {formatTime(songElapsed)}
              </span>
              <span className="text-white/25 text-[10px] tabular-nums">
                / {formatTime(songDuration)}
              </span>
            </div>
            <div className="h-px bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/50 rounded-full transition-all duration-500"
                style={{ width: `${songProgressPct}%` }}
              />
            </div>
          </div>

          {/* 재생 / 일시정지 */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10 hover:bg-white/90 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* 곡 진행 도트 */}
          <div className="flex items-center justify-center gap-1.5">
            {songOrder.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i === currentSongIdx ? "w-4 h-1 bg-white/50" : i < currentSongIdx ? "w-1 h-1 bg-white/15" : "w-1 h-1 bg-white/8"
              }`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
