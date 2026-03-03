import { AppTopBar } from "@/components";
import { requireAuthenticatedUser } from "@/lib/auth";
import Link from "next/link";
import { HomeHeaderText } from "./home-header-text";
import { HomeProjectList } from "./home-project-list";

export default async function HomePage() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: projects } = await supabase
    .from("project")
    .select("id, name, created_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(4);

  const displayName = user?.user_metadata?.name ?? user?.email ?? "사용자";

  return (
    <section className="mx-auto max-w-5xl pb-10">
      <AppTopBar
        leftSlot={
          <Link
            href="/home"
            className="inline-flex items-center px-3 py-1.5 text-base font-semibold text-gray-800 dark:text-gray-100"
          >
            Worship Support
          </Link>
        }
      />
      <div className="mt-14">
        <HomeHeaderText displayName={displayName} />
      </div>
      <div className="mt-14">
        <HomeProjectList projects={projects ?? []} />
      </div>
    </section>
  );
}
