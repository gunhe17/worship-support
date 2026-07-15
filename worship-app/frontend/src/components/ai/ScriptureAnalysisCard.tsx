import type { ScriptureAnalysis } from "@/types";

interface Props {
  analysis: ScriptureAnalysis;
}

export function ScriptureAnalysisCard({ analysis }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 mb-2">스토리라인</p>
        <p className="text-sm text-gray-700 leading-relaxed">{analysis.storyline}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-2">주제</p>
          <div className="flex flex-wrap gap-1">
            {analysis.themes.map((theme) => (
              <span key={theme} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                {theme}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">키워드</p>
          <div className="flex flex-wrap gap-1">
            {analysis.keywords.map((kw) => (
              <span key={kw} className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">감정 흐름</p>
        <div className="flex items-center gap-1 flex-wrap">
          {analysis.emotional_flow.map((flow, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-full">
                {flow}
              </span>
              {i < analysis.emotional_flow.length - 1 && (
                <span className="text-gray-300 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
