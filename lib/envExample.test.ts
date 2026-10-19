// .env.example is committed to GitHub, so it must only ever list names.
// Real values belong in .env.local, which git ignores.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe(".env.example", () => {
  it("lists variable names with no values", () => {
    const lines = readFileSync(".env.example", "utf8")
      .split("\n")
      .filter((line) => /^[A-Za-z0-9_]+\s*=/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, "put real values in .env.local, not .env.example").toMatch(/^[A-Za-z0-9_]+\s*=\s*$/);
  });
});
