import { Suspense } from "react";

import JoinLink from "@/features/join/JoinLink";

export default function Page() {
  return (
    <Suspense>
      <JoinLink />
    </Suspense>
  );
}
