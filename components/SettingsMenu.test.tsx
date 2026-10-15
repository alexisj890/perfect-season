// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsMenu } from "./SettingsMenu";
import { SETTINGS_STORAGE_KEY } from "./useSettings";

afterEach(cleanup);

describe("SettingsMenu", () => {
  it("turns the draft timer off and on, and remembers it", () => {
    render(<SettingsMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const timer = screen.getByRole("switch", { name: /Draft timer/ });
    expect(timer.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(timer);
    expect(timer.getAttribute("aria-checked")).toBe("false");
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({ draftTimer: false });
    fireEvent.click(timer);
    expect(timer.getAttribute("aria-checked")).toBe("true");
  });

  it("switches larger text on the whole page", () => {
    render(<SettingsMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const large = screen.getByRole("switch", { name: /Larger text/ });
    expect(large.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(large);
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({ largeText: true });
    fireEvent.click(large);
    expect(document.documentElement.hasAttribute("data-text-size")).toBe(false);
  });
});
