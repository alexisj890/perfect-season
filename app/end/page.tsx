import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PhasePlaceholder } from "@/components/screens/PhasePlaceholder";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PhasePlaceholder data={gameData} phase="finished" title="Season over" comingIn="6.6" />
    </Suspense>
  );
}
