// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PenaltyPractice } from "./PenaltyPractice";

afterEach(cleanup);

describe("PenaltyPractice", () => {
  it("opens the game in a modal with the stats in its header", () => {
    render(<PenaltyPractice />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Warm up: penalty practice" }));
    const dialog = screen.getByRole("dialog", { name: "Penalty practice" });
    expect(dialog.textContent).toMatch(/Goals 0\/0 · Streak 0 · Best/);
    expect(screen.getByRole("img", { name: /shoot at goal/ })).toBeTruthy();
  });

  it("keeps the session when closed and reopened", async () => {
    localStorage.setItem("perfect-season:penalty-best", "4");
    render(<PenaltyPractice />);
    const trigger = screen.getByRole("button", { name: "Warm up: penalty practice" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog").textContent).toMatch(/Best 4/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    await act(async () => {}); // let effects settle
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog").textContent).toMatch(/Best 4/);
  });
});
