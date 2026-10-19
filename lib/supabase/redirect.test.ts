import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/season")).toBe("/season");
    expect(safeNext("/account/reset-password")).toBe("/account/reset-password");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", ""]) {
      expect(safeNext(bad), bad).toBe("/");
    }
    expect(safeNext(null, "/?auth=confirmed")).toBe("/?auth=confirmed");
  });
});
