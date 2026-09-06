import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEED_REVALIDATE } from "./crm";

/**
 * How fresh the site is, stated once in README and held to the code here.
 *
 * Three caches sit between a change in the CRM and a visitor, and each holds
 * for FEED_REVALIDATE seconds: the CRM's edge (its route sends max-age=60,
 * pinned by gnk-crm tests/unit/public-listings-route.test.ts), this site's
 * data cache (`next: { revalidate: FEED_REVALIDATE }` in lib/crm.ts) and each
 * page's ISR (`export const revalidate`). Three files say "60" and README
 * says it in prose; until this test nothing connected the four, and a comment
 * on each page asked a human to "keep this in step". The audit's S1.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(root, "README.md"), "utf-8");

const PAGES = ["app/page.tsx", "app/properties/page.tsx", "app/properties/[reference]/page.tsx"];

describe("the three caches hold for the same sixty seconds", () => {
  it("every ISR page revalidates after FEED_REVALIDATE, not a number of its own", () => {
    for (const page of PAGES) {
      const src = readFileSync(join(root, page), "utf-8");
      const m = /export const revalidate = (\d+);/.exec(src);
      expect(m, page + " declares revalidate").not.toBeNull();
      expect(Number(m![1]), page).toBe(FEED_REVALIDATE);
    }
  });

  it("the feed is read with the same window", () => {
    const crm = readFileSync(join(root, "lib/crm.ts"), "utf-8");
    expect(crm).toMatch(/next: \{ revalidate: FEED_REVALIDATE \}/);
  });
});

describe("README states the freshness the code delivers", () => {
  const section = readme.slice(readme.indexOf("## How fresh the site is"));
  const minutes = Math.ceil((3 * FEED_REVALIDATE) / 60);
  const words = ["zero", "one", "two", "three", "four", "five", "six"];

  it("has the section", () => {
    expect(section.length, "README § How fresh the site is").toBeGreaterThan(100);
  });

  it("names each cache's window from the constant", () => {
    expect(section).toContain(`max-age=${FEED_REVALIDATE}`);
    expect(section).toContain("`FEED_REVALIDATE`");
    expect(section).toContain(`revalidate = ${FEED_REVALIDATE}`);
    expect(section).toContain(`${FEED_REVALIDATE} seconds`);
  });

  it("states the worst case under traffic as the sum of the three", () => {
    expect(section).toContain(`about ${words[minutes]} minutes`);
  });

  it("does not promise what a quiet site cannot deliver", () => {
    // The first visitor after a lull is served the last render, however old.
    expect(section).toMatch(/however old/);
  });
});
