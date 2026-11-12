import { Suspense } from "react";

import Manage from "@/features/space/Manage";

export default function Page() {
  return (
    <Suspense>
      <Manage />
    </Suspense>
  );
}
