import { Suspense } from "react";

import Login from "@/features/auth/Login";

export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
