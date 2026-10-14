import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { DraftScreen } from "@/components/screens/DraftScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading the draft room…" />}>
      <DraftScreen data={gameData} />
    </Suspense>
  );
}
