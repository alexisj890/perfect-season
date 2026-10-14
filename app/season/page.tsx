import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PhasePlaceholder } from "@/components/screens/PhasePlaceholder";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PhasePlaceholder data={gameData} phase="season" title="Season" comingIn="6.3" />
    </Suspense>
  );
}
