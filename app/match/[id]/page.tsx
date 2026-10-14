import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { MatchScreen } from "@/components/screens/MatchScreen";
import { gameData } from "@/lib/data/gameData";

// The match id is read in the browser (the run, and so the match, only exists there).
export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading match…" />}>
      <MatchScreen data={gameData} />
    </Suspense>
  );
}
