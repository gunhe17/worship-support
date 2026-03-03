import { requireAuthenticatedUser } from "@/lib/auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser();

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
