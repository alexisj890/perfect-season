import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { NewRunScreen } from "@/components/screens/NewRunScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <NewRunScreen data={gameData} />
    </Suspense>
  );
}
