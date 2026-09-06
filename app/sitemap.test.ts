import { afterEach, describe, expect, it, vi } from "vitest";
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
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        ok({
          listings: [{ reference: "PAF0001" }, { reference: "PAF0003" }, { reference: "PAF0004" }],
          limit: 50,
        }) as never,
    );
    const urls = (await sitemap()).map((e) => e.url);
    for (const ref of ["PAF0001", "PAF0003", "PAF0004"]) {
      expect(urls.some((u) => u.endsWith("/properties/" + ref)), ref).toBe(true);
    }
    expect(urls.some((u) => u.endsWith("/properties"))).toBe(true);
  });
});
