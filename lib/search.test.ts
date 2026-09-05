import { describe, expect, it } from "vitest";
import { priceStepsFor } from "./search";

/** The three properties actually published on 2026-09-05. */
const LIVE = [285_000, 450_000, 780_000];

describe("a price step has to be able to return something", () => {
  it("drops a step below the cheapest listing", () => {
    // The live bar offered "Up to €250k" against a cheapest of €285,000, so
    // choosing it could only ever produce "Nothing here matches that yet".
    expect(priceStepsFor(LIVE)).not.toContain(250_000);
  });

  it("keeps the steps that genuinely divide the book", () => {
    expect(priceStepsFor(LIVE)).toEqual([500_000, 750_000]);
  });

  it("drops a step at or above the dearest, which would filter nothing out", () => {
    expect(priceStepsFor([100_000, 200_000])).toEqual([]);
    expect(priceStepsFor(LIVE)).not.toContain(1_000_000);
  });

  it("offers nothing at all for a single listing", () => {
    expect(priceStepsFor([450_000])).toEqual([]);
    expect(priceStepsFor([])).toEqual([]);
  });

  it("offers nothing when every listing costs the same", () => {
    // Six villas at €800,000 — the PAF0002 development, if its units were ever
    // published individually. No step can divide them.
    expect(priceStepsFor([800_000, 800_000, 800_000])).toEqual([]);
  });

  it("every step it offers includes at least one and excludes at least one", () => {
    for (const prices of [LIVE, [95_000, 4_000_000], [300_000, 600_000, 900_000, 3_000_000]]) {
      for (const step of priceStepsFor(prices)) {
        expect(prices.some((p) => p <= step), `${step} includes nothing`).toBe(true);
        expect(prices.some((p) => p > step), `${step} excludes nothing`).toBe(true);
      }
    }
  });
});
