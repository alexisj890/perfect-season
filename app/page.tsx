import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <HomeScreen data={gameData} />
    </Suspense>
  );
}
