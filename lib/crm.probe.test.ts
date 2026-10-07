import { afterEach, describe, expect, it, vi } from "vitest";
import { feedAnswers } from "./crm";
import { feedEnvelope, feedRow } from "./feed-fixtures";

/**
 * The revalidate door's one question before it expires anything: is the feed
 * answering right now? (T-unit-site-revalidate)
 *
 * A knock makes the next visitor wait for a fresh render; with the feed down
 * that render throws and a listing page answers 500 where, left alone, it
 * keeps serving its last good copy. Measured on a production build
 * 2026-10-08 — so the door asks first, and every way the feed can fail to
 * answer must read as "no".
 */
afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("feedAnswers", () => {
  it("yes: a well-formed page of the book — read once, never from the data cache", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => ok(feedEnvelope([feedRow()])) as never);
    expect(await feedAnswers(null)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(url).toMatch(/\/api\/public\/listings\?org=[^&]+&offset=0$/);
    expect(init.cache, "a probe answered from the data cache proves nothing").toBe("no-store");
    expect(init.signal, "a feed that hangs must not hold the CRM's knock past its own timeout").toBeInstanceOf(AbortSignal);
  });

  it("yes, for a named listing, when the feed answers — even with no such row (a sold unit has left it)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => ok(feedEnvelope([])) as never);
    expect(await feedAnswers("PAF0007-B203")).toBe(true);
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/&reference=PAF0007-B203$/);
  });

  const failures: Array<[string, () => Promise<Response>]> = [
    ["a 503", () => Promise.resolve(new Response("", { status: 503 }))],
    ["a 500 with an HTML error page", () => Promise.resolve(new Response("<html>oops</html>", { status: 500 }))],
    ["a dead network", () => Promise.reject(new TypeError("fetch failed"))],
    ["a timeout", () => Promise.reject(new DOMException("aborted", "TimeoutError"))],
    ["a 200 that is not the contract", () => ok({ listings: null })],
    ["a 200 that is not JSON", () => Promise.resolve(new Response("<html/>", { status: 200 }))],
  ];
  for (const [what, impl] of failures) {
    it(`no: ${what} — and it says so, as a warning, without the payload`, async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
      expect(await feedAnswers("PAF0001")).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls.flat().map(String).join(" ")).toContain("nothing rebuilt");
    });
  }
});
