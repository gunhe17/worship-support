import Link from "next/link";
import type { Worship } from "@/types";

interface Props {
  worship: Worship;
}

export function WorshipCard({ worship }: Props) {
  const date = new Date(worship.created_at).toLocaleDateString("ko-KR");

  return (
    <Link href={`/worship/${worship.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        <p className="text-xs text-gray-400 mb-1">{date}</p>
        <h3 className="font-semibold text-gray-900 mb-1">{worship.title}</h3>
        <p className="text-sm text-gray-500 truncate">{worship.scripture}</p>
        {worship.sermon_direction && (
          <span className="inline-block mt-3 text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded-full">
            설교 방향성 있음
          </span>
        )}
      </div>
    </Link>
  );
}
