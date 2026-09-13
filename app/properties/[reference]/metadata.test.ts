import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

/**
 * The page refuses to answer 404 when the feed is unreachable — a live client
 * mandate must never be told "gone" because of a hiccup at our end — and the
 * title has to refuse in the same way. It did not: any failed lookup returned
 * "Property not found", so a transient timeout during a build baked that title
 * into a page whose content was fine (Supabase logs, 2026-09-13: three 504s in
 * the minute of a site build). Without the feed, the reference is the one true
 * thing known about the page; "not found" is reserved for a feed that ANSWERED
 * and holds no such listing.
 */
const params = (reference: string) => ({ params: Promise.resolve({ reference }) });

afterEach(() => vi.restoreAllMocks());

describe("a listing's metadata when the feed cannot be reached", () => {
  it("never says 'not found' — it names the reference and nothing else", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => Promise.resolve(new Response("", { status: 504 })) as never,
    );
    const meta = await generateMetadata(params("PAF0001"));
    expect(String(meta.title)).not.toMatch(/not found/i);
    expect(String(meta.title)).toContain("PAF0001");
  });

  it("still says 'not found' when the feed answered and holds no such reference", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ listings: [], limit: 50, offset: 0 }), { status: 200 }),
        ) as never,
    );
    const meta = await generateMetadata(params("PAF9999"));
    expect(meta.title).toBe("Property not found");
  });
});
