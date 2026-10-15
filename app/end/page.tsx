import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { EndScreen } from "@/components/screens/EndScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading your season…" />}>
      <EndScreen data={gameData} />
    </Suspense>
  );
}
