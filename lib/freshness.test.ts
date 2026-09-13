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

  it("states the stale ceiling from next.config.ts, not a number of its own", () => {
    // On 13 September 2026 the home page was served with a render date of the
    // 8th and /properties with one of the 7th: Next's default `expireTime` is
    // a year, so a quiet site served the last render "however old". The
    // ceiling is now declared once in next.config.ts and README repeats it
    // from there — an hour, in words, the way the paragraph says "three
    // minutes" for the traffic case.
    const seconds = staleCeilingSeconds();
    expect(seconds % 3600, "expireTime is a whole number of hours").toBe(0);
    const hours = seconds / 3600;
    // README is hard-wrapped, so a two-word phrase may straddle a line break.
    const prose = section.replace(/\s+/g, " ");
    expect(prose).toContain(`expireTime = ${seconds}`);
    expect(prose).toContain(`${words[hours]} hour`);
    expect(prose).not.toMatch(/however old/);
  });
});

/** The stale-while-revalidate ceiling, read from the config the platform reads. */
function staleCeilingSeconds(): number {
  const config = readFileSync(join(root, "next.config.ts"), "utf-8");
  const m = /expireTime:\s*(\d+)/.exec(config);
  expect(m, "next.config.ts declares expireTime").not.toBeNull();
  return Number(m![1]);
}

describe("the functions run beside the data they read", () => {
  it("vercel.json pins the site to the CRM's region", () => {
    // Every page measured on 13 September 2026 carried X-Vercel-Id
    // `fra1::iad1`: the edge in Frankfurt forwarding to a function in
    // Washington, which then fetched the feed from Frankfurt. The CRM pinned
    // fra1 on 2026-08-20 for the same reason and measured ~3x on every route.
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf-8")) as {
      regions?: unknown;
    };
    expect(vercel.regions).toEqual(["fra1"]);
  });
});
