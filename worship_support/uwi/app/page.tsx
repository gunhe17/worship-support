import { Suspense } from "react";

import Home from "@/features/home/Home";

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
