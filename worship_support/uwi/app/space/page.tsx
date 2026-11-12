import { Suspense } from "react";

import Space from "@/features/space/Space";

export default function Page() {
  return (
    <Suspense>
      <Space />
    </Suspense>
  );
}
