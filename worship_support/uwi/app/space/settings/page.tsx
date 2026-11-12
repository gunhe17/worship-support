import { Suspense } from "react";

import Settings from "@/features/space/Settings";

export default function Page() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
