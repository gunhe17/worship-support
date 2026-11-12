import { Suspense } from "react";

import Friends from "@/features/friends/Friends";

export default function Page() {
  return (
    <Suspense>
      <Friends />
    </Suspense>
  );
}
