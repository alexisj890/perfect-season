import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PlayoffsScreen } from "@/components/screens/PlayoffsScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading the playoffs…" />}>
      <PlayoffsScreen data={gameData} />
    </Suspense>
  );
}
