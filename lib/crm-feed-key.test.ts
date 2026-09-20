import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getListing, getListings } from "./crm";
import { feedEnvelope, feedRow } from "./feed-fixtures";

/**
 * The site proves it is itself on feed reads too, not only on enquiries.
 *
 * The CRM meters the anonymous feed at 120 calls per 15 minutes per address.
 * Every ISR regeneration, every by-reference listing lookup and every sitemap
 * render is a feed call from this site's ONE egress address, so as the book
 * grows a crawler sweeping every page after the cache lapses spends that
 * budget in a minute, and a 429 turns every page into its last good copy
 * (audit REL-03). Since 2026-09-06 the enquiry door believes a visitor header
 * only when `x-gnk-forward-key` matches; the feed now reads the same key and
 * exempts a proven caller from the feed meter (it used to buy a larger budget). The key still lifts
 * nothing for anyone else: unset, the site is metered as a stranger.
 */
const OLD = { ...process.env };
const captured: Array<Record<string, string>> = [];

beforeEach(() => {
  captured.length = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(((_: unknown, init?: RequestInit) => {
    captured.push((init?.headers ?? {}) as Record<string, string>);
    return Promise.resolve(
      // a whole row, so the reader accepts the answer rather than refusing it under the contract
      new Response(JSON.stringify(feedEnvelope([feedRow()])), {
        status: 200,
        headers: { etag: 'W/"snap-d0"' },
      }),
    );
  }) as never);
});
afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("feed reads carry the forward key", () => {
  it("sends x-gnk-forward-key on the book and on a single lookup when configured", async () => {
    process.env.CRM_FORWARD_KEY = "the-shared-key";
    await getListings();
    await getListing("PAF0001");
    expect(captured.length).toBe(2);
    for (const h of captured) expect(h["x-gnk-forward-key"]).toBe("the-shared-key");
  });

  it("sends no such header when unset — the site is then metered as a stranger, as README says", async () => {
    delete process.env.CRM_FORWARD_KEY;
    await getListings();
    await getListing("PAF0001");
    expect(captured.length).toBe(2);
    for (const h of captured) expect(h).not.toHaveProperty("x-gnk-forward-key");
  });
});
