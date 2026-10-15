// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { DraftPitch } from "./DraftPitch";
import { chemistryWithSquad, displayRating, filterPool, groupOf, slotOptions } from "./draftView";
import { PlayerPool } from "./PlayerPool";

afterEach(cleanup);

const data = loadGameData();
const player = (id: string) => data.players.find((p) => p.id === id)!;
const slots = data.formation.slots;
const clubs = [...new Set(data.players.map((p) => p.club))].sort();

describe("draft helpers", () => {
  it("rounds ratings to whole numbers", () => {
    expect(displayRating(99.9)).toBe(100);
    expect(displayRating(87.35)).toBe(87);
  });

  it("groups players by their main position", () => {
    expect(groupOf(player("david-seaman"))).toBe("GK");
    expect(groupOf(player("tony-adams"))).toBe("DEF");
    expect(groupOf(player("xavi-hernandez"))).toBe("MID");
    expect(groupOf(player("lionel-messi"))).toBe("FWD");
  });

  it("filters by search (ignoring accents), position and club, best first", () => {
    expect(filterPool(data.players, { search: "fabregas", group: "ALL", club: "ALL" }).map((p) => p.name)).toEqual([
      "Cesc Fàbregas",
    ]);
    const keepers = filterPool(data.players, { search: "", group: "GK", club: "ALL" });
    expect(keepers).toHaveLength(21); // 16 club XI keepers + 5 pool-only extras
    expect(keepers[0].weightedScore).toBeGreaterThanOrEqual(keepers[20].weightedScore);
    expect(filterPool(data.players, { search: "", group: "ALL", club: "Ajax" })).toHaveLength(12); // XI + Frank de Boer
  });

  it("ranks open slots by the player's rating there", () => {
    const options = slotOptions(player("xavi-hernandez"), slots, data);
    expect(options[0]).toMatchObject({ slot: "CM", fit: "Natural" });
    expect(options.at(-1)!.fit).toBe("Goalkeeper swap");
  });

  it("totals chemistry with the squad so far", () => {
    const { total, links } = chemistryWithSquad(player("andres-iniesta"), [player("xavi-hernandez")], data);
    expect(total).toBe(5);
    expect(links[0].links.join(" ")).toMatch(/Clubmates/);
  });
});

describe("PlayerPool", () => {
  it("narrows the list as you search and filter", () => {
    const onSelect = vi.fn();
    render(<PlayerPool players={data.players} clubs={clubs} selectedId={null} onSelect={onSelect} />);
    const list = screen.getByRole("list", { name: "Available players" });
    expect(within(list).getAllByRole("button")).toHaveLength(194);

    fireEvent.click(screen.getByRole("button", { name: "GK" }));
    expect(within(list).getAllByRole("button")).toHaveLength(21);

    fireEvent.change(screen.getByLabelText("Search players or clubs"), { target: { value: "buffon" } });
    const rows = within(list).getAllByRole("button");
    expect(rows).toHaveLength(1);
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith("gianluigi-buffon");
  });
});

describe("DraftPitch", () => {
  it("lets you click an open slot only when a player is selected and it's your turn", () => {
    const onPick = vi.fn();
    const options = slotOptions(player("xavi-hernandez"), slots, data);
    const { rerender } = render(<DraftPitch slots={slots} lineup={{}} options={options} canPick={false} onPick={onPick} />);
    const cm = screen.getByRole("button", { name: /Draft into CM: Natural/ });
    expect((cm as HTMLButtonElement).disabled).toBe(true);

    rerender(<DraftPitch slots={slots} lineup={{}} options={options} canPick onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Draft into CM: Natural/ }));
    expect(onPick).toHaveBeenCalledWith("CM");
  });

  it("shows drafted players with their rating", () => {
    const xavi = player("xavi-hernandez");
    render(
      <DraftPitch slots={slots} lineup={{ CM: { player: xavi, rating: xavi.weightedScore } }} options={null} canPick={false} onPick={() => {}} />,
    );
    expect(screen.getByRole("button", { name: `CM: Xavi Hernández, ${displayRating(xavi.weightedScore)}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ST: open" })).toBeTruthy();
  });
});
