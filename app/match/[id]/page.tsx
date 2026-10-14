import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { MatchPlaceholder } from "@/components/screens/MatchPlaceholder";

// The match id is read in the browser (the run, and so the match, only exists there).
export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading match…" />}>
      <MatchPlaceholder />
    </Suspense>
  );
}
