"use client";

// The draft room. Computer picks play out one by one (skippable); on your turn
// you pick a player from the pool, then click an open slot on the pitch.
// The run is saved after every pick.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DevPanel } from "@/components/DevPanel";
import { DraftBoard } from "@/components/draft/DraftBoard";
import { DraftClock } from "@/components/draft/DraftClock";
import { DraftPitch } from "@/components/draft/DraftPitch";
import { DraftSummary } from "@/components/draft/DraftSummary";
import { DraftTopBar } from "@/components/draft/DraftTopBar";
import { chemistryWithSquad, pickLabel, slotOptions } from "@/components/draft/draftView";
import { PlayerPanel, PlayerPanelEmpty } from "@/components/draft/PlayerPanel";
import { PlayerPool } from "@/components/draft/PlayerPool";
import { useRequirePhase } from "@/components/useRequirePhase";
import { useSavedRun } from "@/components/useSavedRun";
import { useSettings } from "@/components/useSettings";
import type { GameData, SlotId } from "@/lib/data/types";
import { BEST_AVAILABLE, pickOnce, runCpuPicks } from "@/lib/draft/cpu";
import { availablePlayers, currentTurn, makePick, openSlots, totalPicks } from "@/lib/draft/draft";
import { teamChemistry } from "@/lib/engine/chemistry";
import { slotRating } from "@/lib/engine/positionFit";
import { startSeason, teamProfiles, userTeam } from "@/lib/run";

export const CPU_PICK_MS = 300;

const DRAFT_ROOM_HEIGHT = "max(100dvh - 14rem, 28rem)";
const DRAFT_GRID = {
  height: `calc(${DRAFT_ROOM_HEIGHT})`,
  gridTemplateColumns: `calc((${DRAFT_ROOM_HEIGHT} - 2rem) * 100 / 130) minmax(0, 1fr) minmax(0, 22rem)`,
};

export function DraftScreen({ data }: { data: GameData }) {
  const router = useRouter();
  const { run, update, clear } = useSavedRun();
  const ready = useRequirePhase(run, "draft");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"draft" | "board">("draft");
  const [notice, setNotice] = useState<string | null>(null);
  const { draftTimer } = useSettings();

  const playersById = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data]);
  const slotsById = useMemo(() => new Map(data.formation.slots.map((s) => [s.id, s])), [data]);
  const clubs = useMemo(() => [...new Set(data.players.map((p) => p.club))].sort(), [data]);

  const draft = run?.draft;
  const turn = draft ? currentTurn(draft) : null;
  const me = run ? userTeam(run) : -1;
  const usersTurn = turn?.teamIndex === me;
  const turnNumber = turn?.pickNumber ?? null;

  // Computer picks, one at a time.
  useEffect(() => {
    if (!run || turnNumber === null || usersTurn) return;
    const timer = setTimeout(() => update({ ...run, draft: pickOnce(run.draft, data) }), CPU_PICK_MS);
    return () => clearTimeout(timer);
  }, [run, turnNumber, usersTurn, update, data]);

  if (!ready || !run || !draft) return null;

  const myPicks = draft.picks.filter((p) => p.teamIndex === me);
  const lineup = Object.fromEntries(
    myPicks.map((p) => {
      const player = playersById.get(p.playerId)!;
      return [p.slot, { player, rating: slotRating(player, slotsById.get(p.slot)!, data) }];
    }),
  );
  const squad = myPicks.map((p) => playersById.get(p.playerId)!);
  const open = openSlots(draft, me, data).map((id) => slotsById.get(id)!);
  const selected = selectedId ? playersById.get(selectedId) : undefined;
  const selectedAvailable = selected && availablePlayers(draft, data).some((p) => p.id === selected.id) ? selected : undefined;
  const options = selectedAvailable ? slotOptions(selectedAvailable, open, data) : null;

  function pick(slot: SlotId) {
    if (!usersTurn || !selectedAvailable) return;
    update({ ...run!, draft: makePick(draft!, data, selectedAvailable.id, slot) });
    setSelectedId(null);
    setNotice(null);
  }

  // The Auto-pick button, and the timer running out: the best-rated player for an open slot.
  function autoPick(timedOut: boolean) {
    const next = pickOnce(draft!, data, BEST_AVAILABLE);
    update({ ...run!, draft: next });
    setSelectedId(null);
    const made = next.picks.at(-1)!;
    setNotice(timedOut ? `Time ran out, so we picked ${playersById.get(made.playerId)!.name} for ${made.slot}.` : null);
  }

  const recent = draft.picks
    .slice(-5)
    .reverse()
    .map((p) => ({ label: `#${p.pickNumber} ${pickLabel(p, draft.teams, playersById)}`, mine: p.teamIndex === me }));

  const done = turn === null;
  let summary = null;
  if (done) {
    const profiles = teamProfiles(run, data);
    const strength = (i: number) => (profiles[i].attack + profiles[i].defence) / 2;
    const rank = 1 + profiles.filter((_, i) => strength(i) > strength(me)).length;
    summary = (
      <DraftSummary
        teamName={draft.teams[me].name}
        rank={rank}
        teamCount={draft.teams.length}
        attack={profiles[me].attack}
        defence={profiles[me].defence}
        chemistry={profiles[me].chemistry}
        onStart={() => {
          update(startSeason(run));
          router.push("/season");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DraftTopBar
        round={turn?.round ?? draft.rounds}
        rounds={draft.rounds}
        pickNumber={turn?.pickNumber ?? totalPicks(draft)}
        totalPicks={totalPicks(draft)}
        onClock={turn ? draft.teams[turn.teamIndex].name : null}
        usersTurn={usersTurn}
        recent={recent}
        onSkip={() => update({ ...run, draft: runCpuPicks(draft, data) })}
        onAutoPick={() => autoPick(false)}
        view={tab}
        onView={setTab}
        // Keyed by the pick, so each of the user's picks gets a fresh 60 seconds.
        clock={draftTimer && usersTurn ? <DraftClock key={turnNumber} onExpire={() => autoPick(true)} /> : null}
        notice={notice}
      />

      {tab === "board" ? (
        <DraftBoard draft={draft} playersById={playersById} />
      ) : (
        // Sized to the window (header, page padding and top bar take about 14rem),
        // so the pitch, pool and player details all fit without scrolling the page.
        // The pitch column's width follows from its height: the pitch is 100 wide
        // by 130 tall, and the line under it takes 2rem.
        <div className="grid gap-6" style={DRAFT_GRID}>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1">
              <DraftPitch slots={data.formation.slots} lineup={lineup} options={options} canPick={usersTurn} onPick={pick} />
            </div>
            <p className="text-center text-sm tabular-nums text-muted">
              {myPicks.length} of {draft.rounds} picked · Chemistry {teamChemistry(squad, data)}
            </p>
          </div>
          {summary ? (
            <div className="col-span-2">{summary}</div>
          ) : (
            <>
              <PlayerPool
                players={availablePlayers(draft, data)}
                clubs={clubs}
                selectedId={selectedAvailable?.id ?? null}
                onSelect={setSelectedId}
              />
              {selectedAvailable && options ? (
                <PlayerPanel
                  player={selectedAvailable}
                  options={options}
                  chemistry={chemistryWithSquad(selectedAvailable, squad, data)}
                  canPick={usersTurn}
                  onPick={pick}
                />
              ) : (
                <PlayerPanelEmpty picked={myPicks.length} rounds={draft.rounds} chemistry={teamChemistry(squad, data)} />
              )}
            </>
          )}
        </div>
      )}
      <DevPanel data={data} run={run} update={update} clear={clear} />
    </div>
  );
}
