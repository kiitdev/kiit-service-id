import { describe, expect, it } from "vitest";
import { Kind } from "../src/index.js";

describe("Kind", () => {
  it("has the same members as the Kotlin enum", () => {
    expect(Object.keys(Kind)).toEqual(["App", "CLI", "Web", "API", "Bot", "Agent", "Job", "Worker", "Service", "Test"]);
  });

  it("uses the member name as its value", () => {
    for (const [key, value] of Object.entries(Kind)) {
      expect(value).toBe(key);
    }
  });
});
