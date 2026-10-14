// @vitest-environment jsdom
// (Component tests run in jsdom, a simulated browser, instead of plain Node.)

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, ThemeToggle } from "./ThemeToggle";

afterEach(cleanup);

describe("ThemeToggle", () => {
  it("switches between night and day and remembers the choice", () => {
    document.documentElement.setAttribute("data-theme", "night");
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /day and night/ });

    fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("day");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("day");

    fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("night");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("night");
  });
});
