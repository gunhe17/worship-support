import type { SongRecommendation } from "@/types";

interface Props {
  song: SongRecommendation;
  rank: number;
}

const CONNECTION_LABELS: Record<string, { label: string; color: string }> = {
  chorus_to_chorus: { label: "코러스 연결", color: "bg-purple-100 text-purple-700" },
  end_to_intro: { label: "인트로 연결", color: "bg-blue-100 text-blue-700" },
  start: { label: "시작 곡", color: "bg-green-100 text-green-700" },
};

const MOOD_LABELS: Record<string, { label: string; color: string }> = {
  slow: { label: "느린곡", color: "bg-indigo-50 text-indigo-600" },
  fast: { label: "빠른곡", color: "bg-orange-50 text-orange-600" },
};

export function SongRecommendCard({ song, rank }: Props) {
  const connection = song.connection_to_prev ? CONNECTION_LABELS[song.connection_to_prev] : null;
  const mood = song.mood ? MOOD_LABELS[song.mood] : null;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 hover:border-primary-200 transition-colors">
      {/* 곡 간 연결 배지 */}
      {connection && rank > 1 && (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${connection.color}`}>
          <span>↑</span>
          <span>{connection.label}</span>
          {song.connection_note && (
            <span className="text-opacity-70"> — {song.connection_note}</span>
          )}
        </div>
      )}

      {/* 곡 기본 정보 */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{song.title}</p>
          <p className="text-sm text-gray-400">{song.artist}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 flex-shrink-0 justify-end">
          {mood && (
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${mood.color}`}>
              {mood.label}
            </span>
          )}
          {song.recommended_key && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">{song.recommended_key}</span>
          )}
          {song.bpm > 0 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">{song.bpm} BPM</span>
          )}
          {song.estimated_duration_minutes > 0 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
              약 {song.estimated_duration_minutes}분
            </span>
          )}
        </div>
      </div>

      {/* 추천 이유 */}
      <p className="text-sm text-gray-600 leading-relaxed pl-10">{song.reason}</p>

      {/* 송폼 */}
      {song.song_form?.length > 0 && (
        <div className="pl-10">
          <p className="text-xs text-gray-400 mb-1">추천 송폼</p>
          <div className="flex flex-wrap gap-1">
            {song.song_form.map((form, i) => (
              <span key={i} className="px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded">
                {form}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* YouTube 링크 */}
      {song.youtube_links?.length > 0 && (
        <div className="pl-10 space-y-2">
          <p className="text-xs text-gray-400">YouTube</p>
          {song.youtube_links.map((yt, i) => (
            <a
              key={i}
              href={yt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50 transition-colors group"
            >
              {yt.thumbnail && (
                <img
                  src={yt.thumbnail}
                  alt=""
                  className="w-12 h-9 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 truncate group-hover:text-red-600">
                  {yt.title}
                </p>
                <p className="text-xs text-gray-400">{yt.channel}</p>
              </div>
              <span className="text-xs text-red-400 flex-shrink-0">▶</span>
            </a>
          ))}
        </div>
      )}

      {/* YouTube 결과 없을 때 */}
      {song.youtube_links?.length === 0 && (
        <div className="pl-10">
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + " " + song.artist + " 찬양")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            YouTube에서 직접 검색하기 →
          </a>
        </div>
      )}
    </div>
  );
}
