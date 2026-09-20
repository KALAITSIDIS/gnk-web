import { describe, expect, it } from "vitest";
import { CRM } from "./crm";
import { FEED_KEYS, feedProblems } from "./feed-schema";

/**
 * THE DRIFT ALARM: does the deployed CRM still send what this site is typed
 * against?
 *
 * The CRM pins its feed's 36 columns against its generated database types
 * (gnk-crm RLS test 41); this site types the same 36 in `Listing` (lib/crm.ts)
 * and describes their VALUES in lib/feed-schema.ts. Nothing connects the two
 * repositories, so a column the CRM adds or renames reaches a visitor before it
 * reaches a developer. This asks the live feed, once per CI run.
 *
 * CORRECTNESS DOES NOT LIVE HERE. lib/feed-schema.test.ts holds the fixtures —
 * sale, rental, land, development, missing media, malformed payloads,
 * pagination — and runs offline in milliseconds. This file exists for the one
 * question those fixtures cannot answer: whether the service on the other end
 * of the wire still agrees. Keeping the two together meant a single live row
 * was doing both jobs, and it did the second one by comparing key NAMES alone —
 * blind to a numeric that started arriving as a string, to a nested image
 * shape, to the envelope's pagination fields, and to every row but the first.
 *
 * TWO FAILURE MODES, KEPT APART. An unreachable or empty feed SKIPS with the
 * reason — the site's build already tolerates a feed outage, and a red CI on a
 * CRM hiccup teaches people to ignore red. A feed that ANSWERS and disagrees
 * FAILS, and is meant to.
 *
 * THE BUDGETS HAVE TO NEST, AND THEY DID NOT. The request carried an 8 s abort
 * inside a test whose timeout is vitest's default 5 s (measured on vitest
 * 4.1.11: "Test timed out in 5000ms"), so a CRM that answered SLOWLY — the
 * exact case the skip was written for — killed the test rather than skipping
 * it, and the graceful branch below could never run. The test timeout is now
 * explicitly longer than the abort it contains.
 */
const ABORT_MS = 8_000;
/** Comfortably outside ABORT_MS, so the abort is what ends a slow request. */
const TEST_MS = 20_000;

/**
 * WHICH SERVICE THIS TALKS TO. `CRM` falls back to https://gnk-crm.vercel.app
 * and neither repository's CI sets CRM_API_URL, so an ordinary run asks
 * PRODUCTION — a public, unauthenticated, read-only feed of already-published
 * listings, which is the only thing that can answer the question this file
 * asks. Set CRM_API_URL to ask a local CRM instead. Nothing here writes, and
 * nothing here sends a message.
 */
describe("the feed the site reads has the shape the site types", () => {
  it(
    "every live row carries exactly the columns, and values of the right kind",
    async (ctx) => {
      let res: Response;
      try {
        res = await fetch(`${CRM}/api/public/listings?org=gnk`, {
          signal: AbortSignal.timeout(ABORT_MS),
        });
      } catch (err) {
        return ctx.skip(`feed unreachable: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!res.ok) return ctx.skip(`feed answered ${res.status}`);

      let body: unknown;
      try {
        body = await res.json();
      } catch (err) {
        // A 200 that is not JSON is not an outage. It is a broken contract.
        expect.fail(`feed answered 200 with a body that is not JSON: ${String(err)}`);
      }

      const rows = (body as { listings?: unknown }).listings;
      if (!Array.isArray(rows)) expect.fail("feed answered 200 with no listings array");
      if (rows.length === 0) return ctx.skip("feed is empty — nothing to compare against");

      /* EVERY ROW, and the envelope with them. A book is not homogeneous: land
         carries no bedrooms, a development no year built, a listing without
         photographs a different `images`. Row 0 was whichever listing the CRM
         happened to order first. */
      expect(feedProblems(body), "the live feed disagrees with lib/feed-schema.ts").toEqual([]);

      /* And the column SET, both directions. A key the CRM dropped is invisible
         to a schema whose fields are mostly optional-or-null, and a key it
         added is what this alarm exists for. The schema tolerates an addition
         at runtime on purpose — the site must not go dark over a column it
         merely does not know — so here is where one gets reported. */
      for (const [i, r] of rows.entries()) {
        const who = (r as { reference?: string }).reference ?? "(no reference)";
        expect(Object.keys(r as object).sort(), `listing ${i} — ${who}`).toEqual(
          [...FEED_KEYS].sort(),
        );
      }
    },
    TEST_MS,
  );
});
