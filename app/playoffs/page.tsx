import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PhasePlaceholder } from "@/components/screens/PhasePlaceholder";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PhasePlaceholder data={gameData} phase="playoffs" title="Playoffs" comingIn="6.5" />
    </Suspense>
  );
}
