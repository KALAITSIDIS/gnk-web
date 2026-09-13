import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CRM } from "./crm";

/**
 * The contract between the two repositories, checked from this side.
 *
 * The CRM pins its feed's 36 columns against its generated database types
 * (gnk-crm RLS test 41), and this site types the same 36 in `Listing`
 * (lib/crm.ts). Nothing connected the two: a column the CRM adds or renames
 * reached a visitor before it reached a developer. This reads the live feed's
 * first row once per CI run and requires its keys to be exactly the
 * interface's, so the site's build fails before a visitor sees the drift.
 *
 * Network is part of the test, deliberately, and the failure modes are kept
 * apart: an unreachable or empty feed is SKIPPED with the reason — the
 * site's build already tolerates a feed outage, and a red CI on a CRM
 * hiccup would teach people to ignore red — while a reachable feed with a
 * different shape FAILS.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "lib", "crm.ts"), "utf-8");

/** The keys of `export interface Listing`, optional or not, in source order. */
function listingKeys(): string[] {
  const m = /export interface Listing \{([\s\S]*?)\n\}/.exec(src);
  expect(m, "lib/crm.ts declares interface Listing").not.toBeNull();
  return [...m![1]!.matchAll(/^\s{2}([a-z_]+)\??:/gm)].map((x) => x[1]!);
}

describe("the feed the site reads has the shape the site types", () => {
  it("Listing has the 36 keys the CRM's allowlist pins", () => {
    expect(listingKeys()).toHaveLength(36);
  });

  it("the live feed's first row carries exactly those keys", async (ctx) => {
    let res: Response;
    try {
      res = await fetch(`${CRM}/api/public/listings?org=gnk&limit=1`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      return ctx.skip(`feed unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) return ctx.skip(`feed answered ${res.status}`);
    const body = (await res.json()) as { listings?: Array<Record<string, unknown>> };
    const row = body.listings?.[0];
    if (!row) return ctx.skip("feed is empty — nothing to compare against");
    expect(Object.keys(row).sort()).toEqual([...listingKeys()].sort());
  });
});
