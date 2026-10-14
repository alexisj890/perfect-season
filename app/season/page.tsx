import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { SeasonScreen } from "@/components/screens/SeasonScreen";
import { gameData } from "@/lib/data/gameData";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SeasonScreen data={gameData} />
    </Suspense>
  );
}
