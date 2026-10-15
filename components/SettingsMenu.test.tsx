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
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual({ draftTimer: false });
    fireEvent.click(timer);
    expect(timer.getAttribute("aria-checked")).toBe("true");
  });
});
