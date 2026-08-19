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
        <p className="text-xs text-gray-400 mb-2">{date}</p>
        {worship.scripture && (
          <p className="text-xs text-primary-500 font-medium mb-1">{worship.scripture}</p>
        )}
        <h3 className="font-semibold text-gray-900 mb-1">{worship.title}</h3>
        {worship.sermon_direction && (
          <p className="text-sm text-gray-400 truncate mt-1">{worship.sermon_direction}</p>
        )}
      </div>
    </Link>
  );
}
