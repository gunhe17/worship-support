"use client";

import { useState } from "react";

interface Props {
  ment: string;
  alternatives: string[];
  position: "intro" | "transition" | "outro";
}

const POSITION_LABEL = {
  intro: "첫 멘트",
  transition: "중간 멘트",
  outro: "마무리 멘트",
};

export function MentCard({ ment, alternatives, position }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-yellow-700">{POSITION_LABEL[position]} (추천)</p>
          <button
            onClick={() => handleCopy(ment)}
            className="text-xs text-yellow-600 hover:text-yellow-800"
          >
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ment}</p>
      </div>

      {alternatives.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">대안 멘트</p>
          <div className="space-y-2">
            {alternatives.map((alt, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-gray-50 rounded-lg p-3"
              >
                <p className="text-sm text-gray-600 leading-relaxed flex-1 whitespace-pre-wrap">
                  {alt}
                </p>
                <button
                  onClick={() => handleCopy(alt)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  복사
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
