import { describe, expect, it } from "vitest";
import { passwordProblems } from "./passwordRules";

describe("passwordProblems", () => {
  it("accepts a password with every kind of character", () => {
    expect(passwordProblems("Strong#Pass1")).toEqual([]);
    expect(passwordProblems("Ünïcode-1a")).toEqual(["A capital letter (A–Z)"]);
  });

  it("lists everything that's missing", () => {
    expect(passwordProblems("")).toHaveLength(5);
    expect(passwordProblems("password")).toEqual(["A capital letter (A–Z)", "A number (0–9)", "A symbol, such as ! ? # or @"]);
    expect(passwordProblems("Pass 1word")).toEqual(["A symbol, such as ! ? # or @"]); // a space isn't a symbol
  });
});
