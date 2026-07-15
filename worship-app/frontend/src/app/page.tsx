import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary-700">Worship Support</h1>
        <p className="text-lg text-gray-500">예배 준비의 AI 어시스턴트</p>
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/worship"
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            예배 시작하기
          </Link>
          <Link
            href="/songs"
            className="px-6 py-3 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            찬양 목록
          </Link>
        </div>
      </div>
    </main>
  );
}
