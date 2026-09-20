import { afterEach, describe, expect, it, vi } from "vitest";
import { feedEnvelope, feedRow } from "@/lib/feed-fixtures";
import sitemap from "./sitemap";

/**
 * A sitemap is either whole or absent. With the feed down it used to answer a
 * complete-looking 200 of eight static URLs — a list a crawler accepts as the
 * new truth — defended by a comment about a build-time hazard that
 * force-dynamic had already removed. A 5xx is a fetch error a crawler retries
 * while keeping its last good copy.
 */
const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

afterEach(() => vi.restoreAllMocks());

describe("the sitemap is whole or absent", () => {
  it("throws when the feed is unavailable, rather than publishing a shrunken list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => Promise.resolve(new Response("", { status: 503 })) as never,
    );
    await expect(sitemap()).rejects.toThrow("refusing to publish a partial sitemap");
  });

  it("lists every published reference when the feed answers", async () => {
    // whole rows: the reader checks every response against the feed contract
    // (lib/crm.validation.test.ts) and a bare `{ reference }` is not a row
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => ok(feedEnvelope(["PAF0001", "PAF0003", "PAF0004"].map((reference) => feedRow({ reference })))) as never,
    );
    const urls = (await sitemap()).map((e) => e.url);
    for (const ref of ["PAF0001", "PAF0003", "PAF0004"]) {
      expect(urls.some((u) => u.endsWith("/properties/" + ref)), ref).toBe(true);
    }
    expect(urls.some((u) => u.endsWith("/properties"))).toBe(true);
  });
});
