import { Suspense } from "react";

import FriendLink from "@/features/friends/FriendLink";

export default function Page() {
  return (
    <Suspense>
      <FriendLink />
    </Suspense>
  );
}
