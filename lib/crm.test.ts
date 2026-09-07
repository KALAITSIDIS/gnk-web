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

/** A feed of N references served in pages of `size`, exactly as the CRM does it: offset in, `limit` echoed back. */
const book = (n: number) =>
  Array.from({ length: n }, (_, i) => listing("PAF" + String(i + 1).padStart(4, "0")));
const paged =
  (rows: ReturnType<typeof listing>[], size = 50, etag = 'W/"abc-50-0"') =>
  (url: string | URL | Request) => {
    const u = new URL(String(url instanceof Request ? url.url : url));
    const offset = Number(u.searchParams.get("offset") ?? 0);
    // `?reference=` answers one row, case-insensitively, as the CRM does (0088)
    const ref = u.searchParams.get("reference")?.toLowerCase() ?? null;
    const book = ref ? rows.filter((r) => r.reference.toLowerCase() === ref) : rows;
    const page = book.slice(offset, offset + size);
    return Promise.resolve(
      new Response(JSON.stringify({ listings: page, limit: size, offset, count: page.length }), {
        status: 200,
        headers: { etag },
      }),
    );
  };

describe("the whole book, page by page", () => {
  // The site read `limit=100` once and called it the feed. Listing 101 would
  // have answered 404 on its own page and vanished from the sitemap, silently.
  it("finds listing 101 and 250 — the pages are read until the first short one", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(paged(book(101)) as never);
    const r = await getListings();
    expect(r.ok && r.listings.length).toBe(101);
    const last = await getListing("PAF0101");
    expect(last.ok && last.listing?.reference).toBe("PAF0101");

    vi.spyOn(globalThis, "fetch").mockImplementation(paged(book(250)) as never);
    const big = await getListings();
    expect(big.ok && big.listings.length).toBe(250);
  });

  it("reads the page size the CRM echoes, not a number of its own", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(paged(book(120), 40) as never);
    const r = await getListings();
    expect(r.ok && r.listings.length).toBe(120);
    // 120 rows at 40 a page: three full pages, then the short fourth that ends it
    expect(f.mock.calls.length).toBe(4);
    for (const [url] of f.mock.calls) expect(String(url)).not.toMatch(/limit=/);
  });

  it("refuses the whole book when any page fails — never a partial truth", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const good = paged(book(120));
    vi.spyOn(globalThis, "fetch").mockImplementation(((url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? 0);
      return offset >= 50 ? Promise.resolve(new Response("", { status: 503 })) : good(url);
    }) as never);
    expect(await getListings()).toEqual({ ok: false });
  });

  it("dedupes a reference that straddles a page boundary of a moving book", async () => {
    const rows = book(60);
    vi.spyOn(globalThis, "fetch").mockImplementation(((url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? 0);
      // page two repeats the last row of page one, as a freshly inserted
      // listing shifting the window would make it
      const page = offset === 0 ? rows.slice(0, 50) : [rows[49]!, ...rows.slice(50)];
      return Promise.resolve(
        new Response(JSON.stringify({ listings: page, limit: 50, offset }), { status: 200 }),
      );
    }) as never);
    const r = await getListings();
    expect(r.ok && r.listings.length).toBe(60);
  });

  it("refuses a feed that never ends rather than hanging a render", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (() => ok({ listings: book(50), limit: 50 })) as never,
    );
    expect(await getListings()).toEqual({ ok: false });
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

  it("asks the CRM for ONE reference rather than reading the whole book (gnk-crm 0088)", async () => {
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => ok({ listings: [listing("PAF0001")] }) as never);
    await getListing("paf0001");
    expect(f).toHaveBeenCalledTimes(1);
    const url = new URL(String(f.mock.calls[0]![0]));
    expect(url.searchParams.get("reference")).toBe("paf0001");
    expect(url.searchParams.get("org")).toBe("gnk");
  });

  it("is still the last word: a CRM that ignores the parameter answers the feed, and the wrong row is not taken", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => ok({ listings: [listing("PAF0002"), listing("PAF0003")] }) as never,
    );
    expect(await getListing("PAF0001")).toEqual({ ok: true, listing: null });
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

  it("proves it is the forwarder with the configured key — the CRM believes the address only then", async () => {
    // Since 2026-09-06 the CRM ignores x-gnk-visitor-ip from anyone who cannot
    // present the shared key; without this header every visitor would again
    // share one budget of five.
    vi.stubEnv("CRM_FORWARD_KEY", "the-shared-key");
    try {
      const f = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("", { status: 202 }));
      await submitEnquiry({ name: "A Buyer" }, "198.51.100.22");
      const headers = (f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-gnk-forward-key"]).toBe("the-shared-key");
      expect(headers["x-gnk-visitor-ip"]).toBe("198.51.100.22");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sends no forward key when none is configured, rather than an empty one", async () => {
    vi.stubEnv("CRM_FORWARD_KEY", "");
    try {
      const f = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("", { status: 202 }));
      await submitEnquiry({ name: "A Buyer" }, "198.51.100.22");
      const headers = (f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect("x-gnk-forward-key" in headers).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("carries a 429's status and Retry-After, so the route can pass them to the visitor", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 429, headers: { "retry-after": "900" } }),
    );
    const r = await submitEnquiry({ name: "A Buyer" });
    expect(r).toEqual({
      ok: false,
      error: "Too many enquiries from this address. Please try again shortly.",
      status: 429,
      retryAfter: "900",
    });
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
