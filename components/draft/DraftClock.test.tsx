// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftClock } from "./DraftClock";

let visibility: DocumentVisibilityState = "visible";
beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const timeLeft = () => screen.getByRole("timer").getAttribute("aria-label");

describe("DraftClock", () => {
  it("counts down 60 seconds, then calls onExpire once", () => {
    const onExpire = vi.fn();
    render(<DraftClock onExpire={onExpire} />);
    expect(timeLeft()).toBe("60 seconds left to pick");
    act(() => vi.advanceTimersByTime(30_000));
    expect(timeLeft()).toBe("30 seconds left to pick");
    act(() => vi.advanceTimersByTime(29_000));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_000));
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("warns screen readers once, at 10 seconds", () => {
    render(<DraftClock onExpire={() => {}} />);
    expect(screen.getByText("Your pick. You have 60 seconds.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(50_500));
    expect(screen.getByText("10 seconds left to pick")).toBeTruthy();
  });

  it("pauses while the tab is hidden", () => {
    const onExpire = vi.fn();
    render(<DraftClock onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(20_000));
    visibility = "hidden";
    act(() => vi.advanceTimersByTime(120_000));
    expect(onExpire).not.toHaveBeenCalled();
    visibility = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(1_000);
    });
    expect(timeLeft()).toBe("39 seconds left to pick");
  });
});
