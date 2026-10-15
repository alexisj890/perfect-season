// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGameData } from "@/lib/data/load";
import { finishPlayoffs, finishSeason, finishDraft, startRun } from "@/lib/run";
import { DraftReveal } from "./DraftReveal";
import { NewRunDialog } from "./NewRunDialog";
import { NewRunForm } from "./NewRunForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(cleanup);

describe("NewRunForm", () => {
  it("starts on Normal with the default team name", () => {
    const onStart = vi.fn();
    render(<NewRunForm hasRunInProgress={false} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(onStart).toHaveBeenCalledWith({ teamName: "Your XI", difficulty: "normal" });
  });

  it("passes the chosen name (trimmed) and difficulty", () => {
    const onStart = vi.fn();
    render(<NewRunForm hasRunInProgress={false} onStart={onStart} />);
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "  Alexis FC  " } });
    fireEvent.click(screen.getByRole("radio", { name: /Hard/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(onStart).toHaveBeenCalledWith({ teamName: "Alexis FC", difficulty: "hard" });
  });

  it("starts from the last run's name and difficulty when given them (Try again)", () => {
    const onStart = vi.fn();
    render(<NewRunForm hasRunInProgress={false} defaults={{ teamName: "Alexis FC", difficulty: "hard" }} onStart={onStart} />);
    expect((screen.getByLabelText("Team name") as HTMLInputElement).value).toBe("Alexis FC");
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(onStart).toHaveBeenCalledWith({ teamName: "Alexis FC", difficulty: "hard" });
  });

  it("asks for confirmation before replacing a run in progress", () => {
    const onStart = vi.fn();
    render(<NewRunForm hasRunInProgress onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/replaces your current run/);
    fireEvent.click(screen.getByRole("button", { name: "Yes, start a new run" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("offers all three difficulties", () => {
    render(<NewRunForm hasRunInProgress={false} onStart={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["easy", "normal", "hard"]);
  });
});

describe("DraftReveal", () => {
  it("shows the draft position and every pick number", () => {
    const onEnter = vi.fn();
    render(<DraftReveal teamName="Alexis FC" position={7} teamCount={16} picks={[7, 26, 39]} onEnter={onEnter} />);
    expect(screen.getByText(/Alexis FC pick/).textContent).toBe("Alexis FC pick 7th of 16");
    expect(screen.getByLabelText("Your pick numbers").textContent).toContain("#26");
    fireEvent.click(screen.getByRole("button", { name: "Enter the draft room" }));
    expect(onEnter).toHaveBeenCalled();
  });
});

describe("NewRunDialog", () => {
  const data = loadGameData();

  it("starts a run from the pop-up, reveals the draft position, then enters the draft room", () => {
    const update = vi.fn();
    render(<NewRunDialog data={data} open onClose={() => {}} run={null} update={update} />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Alexis FC" } });
    fireEvent.click(screen.getByRole("radio", { name: /Hard/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    const started = update.mock.calls[0][0];
    expect(started.difficulty).toBe("hard");
    expect(screen.getByRole("dialog", { name: "The draw is in" })).toBe(dialog);
    expect(screen.getByText(/Alexis FC pick/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter the draft room" }));
    expect(push).toHaveBeenCalledWith("/draft");
  });

  it("asks before replacing a run in progress, but not a finished one", () => {
    const inProgress = startRun(data, { id: "a", createdAt: "", seed: 1, difficulty: "easy" });
    const { rerender } = render(<NewRunDialog data={data} open onClose={() => {}} run={inProgress} update={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(screen.getByRole("alert").textContent).toMatch(/replaces your current run/);

    const finished = { ...finishPlayoffs(finishSeason(finishDraft(inProgress, data), data), data), id: "b" };
    rerender(<NewRunDialog data={data} open onClose={() => {}} run={finished} update={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    // Try again: the last run's difficulty is already chosen.
    expect((screen.getByRole("radio", { name: /Easy/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("shows nothing while closed", () => {
    render(<NewRunDialog data={data} open={false} onClose={() => {}} run={null} update={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
