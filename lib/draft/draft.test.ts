import { describe, expect, it } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { buildTeam } from "@/lib/engine/team";
import { createRng } from "@/lib/rng";
import { DRAFT } from "./config";
import { autoDraft, chooseOption, drafterFor, runCpuPicks } from "./cpu";
import {
  availablePlayers,
  createDraft,
  currentTurn,
  isComplete,
  lineupOf,
  makePick,
  openSlots,
  turnAt,
  userTeamIndex,
  type DraftState,
} from "./draft";
import { scoreOptions } from "./styles";

const data = loadGameData();
const slotIds = data.formation.slots.map((s) => s.id);

describe("createDraft", () => {
  it("sets up 16 teams, 11 rounds, and exactly one user team", () => {
    const state = createDraft(data, 1);
    expect(state.teams).toHaveLength(16);
    expect(state.rounds).toBe(11);
    expect(state.picks).toEqual([]);
    expect(state.teams.filter((t) => t.isUser)).toHaveLength(1);
  });

  it("gives the user a random draft position, the same for the same seed", () => {
    expect(userTeamIndex(createDraft(data, 7))).toBe(userTeamIndex(createDraft(data, 7)));
    const positions = new Set(Array.from({ length: 200 }, (_, seed) => userTeamIndex(createDraft(data, seed))));
    expect(positions.size).toBe(16); // every position comes up
  });

  it("refuses to start if the pool is too small", () => {
    expect(() => createDraft({ ...data, players: data.players.slice(0, 100) }, 1)).toThrow(/Need 176/);
  });

  it("gives every computer team a drafting style allowed by the difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const state = createDraft(data, seed, difficulty);
        expect(state.difficulty).toBe(difficulty);
        for (const team of state.teams) {
          if (team.isUser) expect(team.style).toBeNull();
          else expect(DRAFT.difficulties[difficulty].styles[team.style!]).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("snake order", () => {
  const state = createDraft(data, 1);

  it("reverses every round", () => {
    const round = (r: number) => Array.from({ length: 16 }, (_, i) => turnAt(state, (r - 1) * 16 + i + 1).teamIndex);
    const forward = Array.from({ length: 16 }, (_, i) => i);
    expect(round(1)).toEqual(forward);
    expect(round(2)).toEqual([...forward].reverse());
    expect(round(3)).toEqual(forward);
  });

  it("gives the teams at each end back-to-back picks", () => {
    expect(turnAt(state, 16).teamIndex).toBe(15);
    expect(turnAt(state, 17).teamIndex).toBe(15);
    expect(turnAt(state, 32).teamIndex).toBe(0);
    expect(turnAt(state, 33).teamIndex).toBe(0);
  });

  it("gives every team exactly 11 picks", () => {
    const counts = new Array(16).fill(0);
    for (let n = 1; n <= 176; n++) counts[turnAt(state, n).teamIndex]++;
    expect(counts).toEqual(new Array(16).fill(11));
  });
});

describe("makePick", () => {
  const start = createDraft(data, 1);
  const first = currentTurn(start)!;

  it("records the pick and moves to the next team", () => {
    const next = makePick(start, data, "lionel-messi", "RW");
    expect(next.picks).toEqual([{ pickNumber: 1, round: 1, teamIndex: first.teamIndex, playerId: "lionel-messi", slot: "RW" }]);
    expect(currentTurn(next)!.pickNumber).toBe(2);
    expect(availablePlayers(next, data).some((p) => p.id === "lionel-messi")).toBe(false);
    expect(openSlots(next, first.teamIndex, data)).not.toContain("RW");
  });

  it("never changes the previous state", () => {
    const snapshot = JSON.stringify(start);
    makePick(start, data, "lionel-messi", "RW");
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("allows any player in any open slot, out of position included", () => {
    expect(() => makePick(start, data, "david-seaman", "ST")).not.toThrow();
  });

  it("rejects illegal picks", () => {
    const afterMessi = makePick(start, data, "lionel-messi", "RW");
    expect(() => makePick(afterMessi, data, "lionel-messi", "ST")).toThrow(/not available/);
    expect(() => makePick(start, data, "nobody", "ST")).toThrow(/not available/);
    expect(() => makePick(start, data, "johan-cruyff", "XX")).toThrow(/not open/);
    // Team 0 picks again at pick 32; its RW slot is already filled by then.
    let state = afterMessi;
    while (currentTurn(state)!.teamIndex !== 0) state = autoPickOnce(state);
    expect(() => makePick(state, data, availablePlayers(state, data)[0].id, "RW")).toThrow(/not open/);
  });

  it("rejects picks once the draft is complete", () => {
    const done = autoDraft(start, data);
    expect(() => makePick(done, data, "lionel-messi", "RW")).toThrow(/complete/);
  });
});

function autoPickOnce(state: DraftState) {
  const drafter = drafterFor(state, currentTurn(state)!.teamIndex);
  const choice = chooseOption(state, data, drafter, createRng(state.picks.length));
  return makePick(state, data, choice.playerId, choice.slot);
}

describe("a full draft", () => {
  const done = autoDraft(createDraft(data, 3), data);

  it("drafts every player exactly once", () => {
    expect(isComplete(done)).toBe(true);
    expect(currentTurn(done)).toBeNull();
    expect(done.picks).toHaveLength(176);
    expect(new Set(done.picks.map((p) => p.playerId)).size).toBe(176);
    expect(availablePlayers(done, data)).toHaveLength(0);
  });

  it("fills all 11 slots for every team, giving lineups the engine accepts", () => {
    done.teams.forEach((_, i) => {
      expect(Object.keys(lineupOf(done, i)).sort()).toEqual([...slotIds].sort());
      expect(openSlots(done, i, data)).toEqual([]);
      expect(() => buildTeam(lineupOf(done, i), data)).not.toThrow();
    });
  });

  it("numbers picks and rounds in order", () => {
    done.picks.forEach((p, i) => {
      expect(p.pickNumber).toBe(i + 1);
      expect(p.round).toBe(Math.floor(i / 16) + 1);
    });
  });
});

describe("computer picks", () => {
  it("stops at the user's turn", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = runCpuPicks(createDraft(data, seed), data);
      expect(currentTurn(state)!.teamIndex).toBe(userTeamIndex(state));
      expect(state.picks).toHaveLength(userTeamIndex(state)); // everyone ahead of the user picked once
      expect(runCpuPicks(state, data)).toEqual(state); // nothing happens until the user picks
    }
  });

  it("only ever picks from its style's best few options", () => {
    let state = createDraft(data, 9);
    const rng = createRng(9);
    while (!isComplete(state)) {
      const turn = currentTurn(state)!;
      const drafter = drafterFor(state, turn.teamIndex);
      const top = scoreOptions(state, data, turn.teamIndex, drafter.style).slice(0, drafter.candidates);
      const choice = chooseOption(state, data, drafter, rng);
      expect(top).toContainEqual(choice);
      state = makePick(state, data, choice.playerId, choice.slot);
    }
  });

  it("varies a little between drafts but repeats exactly for the same seed", () => {
    expect(autoDraft(createDraft(data, 4), data)).toEqual(autoDraft(createDraft(data, 4), data));
    const firstPicks = new Set(
      Array.from({ length: 40 }, (_, seed) => autoDraft(createDraft(data, seed), data).picks[1].playerId),
    );
    expect(firstPicks.size).toBeGreaterThan(1);
  });
});

describe("saving and resuming", () => {
  it("survives a JSON round trip mid-draft and continues identically", () => {
    const midway = runCpuPicks(createDraft(data, 12), data);
    const userPick = availablePlayers(midway, data)[0];
    const afterUser = makePick(midway, data, userPick.id, "ST");
    const restored = JSON.parse(JSON.stringify(afterUser));
    expect(autoDraft(restored, data)).toEqual(autoDraft(afterUser, data));
  });
});

describe("drafting styles", () => {
  const start = createDraft(data, 1);
  const team = currentTurn(start)!.teamIndex;
  const top = (state: DraftState, style: Parameters<typeof scoreOptions>[3]) =>
    scoreOptions(state, data, team, style)[0];
  // Gives `team` some players, with every other pick going to other teams.
  function withSquad(ids: [string, string][]): DraftState {
    return {
      ...start,
      picks: ids.map(([playerId, slot], i) => ({ pickNumber: i + 1, round: i + 1, teamIndex: team, playerId, slot })),
    };
  }

  it("lists each available player once, in their best open slot", () => {
    for (const style of ["balanced", "ignoresChemistry", "starChaser", "panicFill"] as const) {
      const ids = scoreOptions(start, data, team, style).map((o) => o.playerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const messi = scoreOptions(start, data, team, "ignoresChemistry").find((o) => o.playerId === "lionel-messi")!;
    expect(messi.rating).toBe(data.players.find((p) => p.id === "lionel-messi")!.weightedScore);
  });

  it("star-chaser takes the biggest name even if he has to play out of position", () => {
    // With only defensive slots open, the star-chaser still wants the best player overall.
    const state = withSquad([
      ["lionel-messi", "ST"], ["johan-cruyff", "CAM"], ["diego-maradona", "CM"], ["cristiano-ronaldo", "LW"],
      ["mohamed-salah", "RW"], ["patrick-vieira", "CDM"],
    ]);
    const best = [...availablePlayers(state, data)].sort((a, b) => b.weightedScore - a.weightedScore)[0];
    expect(top(state, "starChaser").playerId).toBe(best.id);
    expect(top(state, "ignoresChemistry").rating).toBeGreaterThanOrEqual(top(state, "starChaser").rating);
  });

  it("panic-filler goes for the slot with the fewest natural options left", () => {
    const choice = top(start, "panicFill");
    const slot = data.formation.slots.find((s) => s.id === choice.slot)!;
    const naturals = (accepts: string) =>
      data.players.filter((p) => p.naturalPositions.includes(accepts)).length;
    for (const other of data.formation.slots) expect(naturals(slot.accepts)).toBeLessThanOrEqual(naturals(other.accepts));
  });

  it("balanced values chemistry with the squad; ignoresChemistry doesn't", () => {
    const state = withSquad([["xavi-hernandez", "CM"]]);
    const iniesta = (style: "balanced" | "ignoresChemistry") =>
      scoreOptions(state, data, team, style).find((o) => o.playerId === "andres-iniesta")!;
    expect(iniesta("balanced").value).toBeGreaterThan(iniesta("ignoresChemistry").value);
    expect(iniesta("ignoresChemistry").value).toBe(iniesta("ignoresChemistry").rating);
  });
});

describe("difficulty", () => {
  it("makes computer teams stronger on harder settings", () => {
    const strength = (difficulty: "easy" | "hard") => {
      let total = 0;
      for (let seed = 0; seed < 6; seed++) {
        const state = autoDraft(createDraft(data, seed, difficulty), data);
        state.teams.forEach((t, i) => {
          if (t.isUser) return;
          const team = buildTeam(lineupOf(state, i), data);
          total += team.attack + team.defence;
        });
      }
      return total;
    };
    expect(strength("hard")).toBeGreaterThan(strength("easy"));
  });
});
