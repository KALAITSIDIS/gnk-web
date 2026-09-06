import { afterEach, describe, expect, it, vi } from "vitest";
import { getListing, getListings, submitEnquiry } from "./crm";

/**
 * The client that decides whether a property exists.
 *
 * THE INVARIANT THIS FILE EXISTS FOR: a feed failure must never be mistaken for
 * "no such property". getListings used to return [] for a 503, a timeout and a
 * genuinely empty book alike, so a hiccup made getListing find nothing, the page
 * call notFound(), and a live client mandate answer HTTP 404 — the signal that
 * removes a URL from Google's index — while the home page simultaneously
 * announced the firm had no properties. Both are silent: the site 200s its way
 * through the outage looking confident and wrong.
 *
 * Every failure mode below returns { ok: false }, which is what lets the page
 * say "briefly unavailable" instead of "gone".
 */

const listing = (reference: string) => ({ reference, kind: "standalone" });
const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

afterEach(() => vi.restoreAllMocks());

describe("a feed failure is never 'no such property'", () => {
  const failures: [string, () => Promise<Response>][] = [
    ["a 503", () => Promise.resolve(new Response("", { status: 503 }))],
    ["a 429", () => Promise.resolve(new Response("", { status: 429 }))],
    ["a 500 with an HTML error page", () =>
      Promise.resolve(new Response("<html>oops</html>", { status: 500 }))],
    ["a dead network", () => Promise.reject(new Error("ECONNREFUSED"))],
    ["a timeout", () => Promise.reject(new DOMException("aborted", "TimeoutError"))],
    ["a 200 carrying no listings array", () => ok({ count: 0 })],
    ["a 200 carrying null listings", () => ok({ listings: null })],
  ];

  for (const [name, impl] of failures) {
    it(`reports ${name} as unavailable, not as empty`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
      expect(await getListings()).toEqual({ ok: false });
    });

    it(`does not let ${name} turn a live listing into a 404`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockImplementation(impl as never);
      // ok:false is what the page checks BEFORE it is allowed to call notFound()
      expect(await getListing("PAF0001")).toEqual({ ok: false });
    });
  }

  it("asks fetch to give up, so a CRM that accepts and never answers cannot hang the page", async () => {
    // The "a timeout" case above only proves a TimeoutError is handled once it
    // arrives. Nothing pinned that one is ever REQUESTED — remove the
    // AbortSignal.timeout(...) from lib/crm.ts and every case still passes,
    // while a stalled CRM holds the home page open until the platform kills
    // the function.
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => ok({ listings: [] }) as never);
    await getListings();
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.signal, "every feed request carries an abort signal").toBeInstanceOf(AbortSignal);
  });

  it("distinguishes a genuinely empty book from a broken feed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => ok({ listings: [] }) as never);
    expect(await getListings()).toEqual({ ok: true, listings: [] });
    // answered, and genuinely has no such property — this one MAY 404
    expect(await getListing("PAF0001")).toEqual({ ok: true, listing: null });
  });
});

describe("finding one listing", () => {
  it("matches a reference whatever case it was typed in", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => ok({ listings: [listing("PAF0001")] }) as never,
    );
    for (const typed of ["PAF0001", "paf0001", "Paf0001"]) {
      const found = await getListing(typed);
      expect(found.ok && found.listing?.reference, typed).toBe("PAF0001");
    }
  });

  it("returns ok with a null listing when the feed answered and has no match", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => ok({ listings: [listing("PAF0001")] }) as never,
    );
    expect(await getListing("PAF9999")).toEqual({ ok: true, listing: null });
  });
});

describe("handing an enquiry to the CRM", () => {
  it("forwards the visitor's address so the budget is theirs, not the whole site's", async () => {
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }));
    await submitEnquiry({ name: "A Buyer" }, "198.51.100.22");
    const headers = (f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["x-gnk-visitor-ip"]).toBe("198.51.100.22");
  });

  it("omits the header entirely when there is no address, rather than sending empty", async () => {
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 202 }));
    await submitEnquiry({ name: "A Buyer" });
    const headers = (f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect("x-gnk-visitor-ip" in headers).toBe(false);
  });

  it("never hands the CRM's validator wording to whoever filled the form", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Too big: expected string to have <=5000 characters" }), {
        status: 400,
      }),
    );
    const r = await submitEnquiry({ name: "A Buyer" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("Too big");
      expect(r.error).toContain("call or WhatsApp");
    }
  });

  it("survives the network being gone without throwing at the route", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    expect((await submitEnquiry({ name: "A Buyer" })).ok).toBe(false);
  });
});
