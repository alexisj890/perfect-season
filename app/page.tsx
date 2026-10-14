import { Suspense } from "react";
import { LandingHero } from "@/components/home/LandingHero";
import { PenaltyPractice } from "@/components/home/PenaltyPractice";
import { PrimaryAction, PrimaryActionPlaceholder } from "@/components/home/PrimaryAction";
import { gameData } from "@/lib/data/gameData";

// Footer facts, worked out from the data rather than typed in.
const clubCount = new Set(gameData.players.map((p) => p.club)).size;
const firstDecade = Math.floor(Math.min(...gameData.players.map((p) => p.peak.start)) / 10) * 10;

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <LandingHero />
        <Suspense fallback={<PrimaryActionPlaceholder />}>
          <PrimaryAction data={gameData} />
        </Suspense>
      </section>
      <footer className="flex items-center justify-between pt-8 text-sm text-muted">
        <span className="tabular-nums">
          {gameData.players.length} legends · {clubCount} clubs · {firstDecade}s to today
        </span>
        <PenaltyPractice />
      </footer>
    </div>
  );
}
