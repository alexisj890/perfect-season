// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftReveal } from "./DraftReveal";
import { NewRunForm } from "./NewRunForm";

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
    expect(screen.getByRole("heading").textContent).toBe("Alexis FC pick 7th of 16");
    expect(screen.getByLabelText("Your pick numbers").textContent).toContain("#26");
    fireEvent.click(screen.getByRole("button", { name: "Enter the draft room" }));
    expect(onEnter).toHaveBeenCalled();
  });
});
