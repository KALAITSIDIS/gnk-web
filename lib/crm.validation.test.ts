import { afterEach, describe, expect, it, vi } from "vitest";
import { getListing, getListings } from "./crm";
import { feedEnvelope, feedRow, without } from "./feed-fixtures";

/**
 * THE READER, NOT THE SCHEMA.
 *
 * lib/feed-schema.test.ts proves what feedEnvelopeSchema accepts and refuses.
 * That proves nothing about the site unless lib/crm.ts applies it, and until
 * 2026-09-20 it did not: `as FeedResponse` was a cast, the only thing examined
 * was that `listings` was an array, and every malformed payload below was
 * served as a complete catalogue — or, for one listing, as `{ ok: true,
 * listing: null }`, which the page turns into the 404 that removes a live
 * mandate from Google's index. A first page that forgot its `limit` was
 * taken as the whole book, and the fifty-first listing simply was not there.
 *
 * So every test here goes through getListings() and getListing(), with fetch
 * stubbed to answer what a broken CRM would. None of them calls safeParse.
 */

afterEach(() => vi.restoreAllMocks());

/** One payload for every request, with an ETag in the CRM's shape. */
const serve = (payload: unknown) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), { status: 200, headers: { etag: 'W/"snap-d0"' } }),
      )) as never,
  );
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("what the reader serves", () => {
  const shapes: [string, Record<string, unknown>][] = [
    ["a complete resale villa", {}],
    [
      "a rental",
      {
        reference: "PAF0006",
        transaction_type: "rent",
        property_type: "apartment",
        asking_price: null,
        rent_price_month: 1750,
        floor_number: 3,
        total_floors: 5,
        vat_status: null,
      },
    ],
    [
      "a development",
      {
        reference: "PAF0002",
        kind: "project",
        asking_price: 800000,
        year_built: null,
        construction_status: "finishing",
        delivery_date: "2099-10-01",
      },
    ],
    ["a studio, whose defining fact is bedrooms 0", { reference: "PAF0008", bedrooms: 0 }],
    ["a listing whose photographs are null", { images: null }],
    ["a listing with no photographs yet", { images: [] }],
    ["a photograph with no alt text written", { images: [{ thumb: "a", card: "b", full: "c", alt: {}, watermarked: false }] }],
    ["a column the CRM added later, which the site does not read", { energy_rating_kwh: 95 }],
  ];

  for (const [name, over] of shapes) {
    it(`serves ${name}, whole, and finds it by reference`, async () => {
      const row = feedRow(over);
      serve(feedEnvelope([row]));
      const all = await getListings();
      expect(all.ok && all.listings.map((l) => l.reference)).toEqual([row.reference]);
      const one = await getListing(String(row.reference));
      expect(one.ok && one.listing?.reference).toBe(row.reference);
    });
  }

  it("keeps a studio's bedrooms at 0 — a number, not a gap", async () => {
    serve(feedEnvelope([feedRow({ bedrooms: 0 })]));
    const one = await getListing("PAF0001");
    expect(one.ok && one.listing?.bedrooms).toBe(0);
  });

  it("a 200 whose body is not JSON at all is unavailable, not empty", async () => {
    // The CRM's edge answering an error page with a 200, or a captive proxy.
    // res.json() throws, the catch reports it, and no caller is told the
    // firm has no properties.
    quiet();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (() => Promise.resolve(new Response("<html>502</html>", { status: 200 }))) as never,
    );
    expect(await getListings()).toEqual({ ok: false });
    expect(await getListing("PAF0001")).toEqual({ ok: false });
  });

  it("a genuinely empty feed is ok and empty, and a lookup in it is ok and null", async () => {
    // The two answers the whole module exists to keep apart: this one MAY be
    // a 404 on a listing page; every refusal below must never be.
    serve(feedEnvelope([]));
    expect(await getListings()).toEqual({ ok: true, listings: [] });
    expect(await getListing("PAF0001")).toEqual({ ok: true, listing: null });
  });

  it("an envelope field the CRM adds later is an additive change, not a refusal", async () => {
    serve(feedEnvelope([feedRow()], { next_offset: 50, generated_at: "2026-09-20T00:00:00Z" }));
    const all = await getListings();
    expect(all.ok && all.listings.length).toBe(1);
  });

  it("matches the reference whatever case it was typed in, on a real row", async () => {
    serve(feedEnvelope([feedRow()]));
    const one = await getListing("paf0001");
    expect(one.ok && one.listing?.reference).toBe("PAF0001");
  });
});

describe("what the reader refuses — as unavailable, never as an empty book and never as a 404", () => {
  const malformed: [string, unknown][] = [
    ["an envelope with no limit", without(feedEnvelope([feedRow()]), "limit")],
    ["a limit sent as a string", feedEnvelope([feedRow()], { limit: "50" })],
    ["a limit of zero", feedEnvelope([feedRow()], { limit: 0 })],
    ["a negative offset", feedEnvelope([feedRow()], { offset: -1 })],
    ["an offset sent as a string", feedEnvelope([feedRow()], { offset: "0" })],
    ["a count that is not a number", feedEnvelope([feedRow()], { count: "1" })],
    ["a title whose English is an object, not a string", feedEnvelope([feedRow({ title: { en: { text: "Villa" } } })])],
    ["a title sent as a bare string", feedEnvelope([feedRow({ title: "Villa" })])],
    ["images sent as an object instead of an array", feedEnvelope([feedRow({ images: { card: "a" } })])],
    ["an image member that is a bare URL", feedEnvelope([feedRow({ images: ["https://x/a.jpg"] })])],
    ["an image missing the rendition the grid uses", feedEnvelope([feedRow({ images: [{ thumb: "a", full: "c" }] })])],
    ["a row with no reference", feedEnvelope([without(feedRow(), "reference")])],
    ["a reference that is empty", feedEnvelope([feedRow({ reference: "" })])],
    ["a reference that is blank", feedEnvelope([feedRow({ reference: "   " })])],
    ["a price arriving as a string", feedEnvelope([feedRow({ asking_price: "450000.00" })])],
    ["a bedroom count that is a word", feedEnvelope([feedRow({ bedrooms: "three" })])],
    ["an envelope with no listings array", without(feedEnvelope([feedRow()]), "listings")],
    ["listings sent as null", feedEnvelope(null)],
    ["a body that is a string, not an object", "<html>502 Bad Gateway</html>"],
    [
      "one bad row among good ones — the book is not served minus that row",
      feedEnvelope([feedRow(), feedRow({ reference: "PAF0002", bedrooms: "three" }), feedRow({ reference: "PAF0003" })]),
    ],
  ];

  for (const [name, payload] of malformed) {
    it(`${name}: the catalogue is unavailable, not complete and not empty`, async () => {
      quiet();
      serve(payload);
      expect(await getListings()).toEqual({ ok: false });
    });

    it(`${name}: the listing page is told "could not look", never "no such property"`, async () => {
      quiet();
      serve(payload);
      // ok:false is what the page checks BEFORE it is allowed to call notFound()
      expect(await getListing("PAF0001")).toEqual({ ok: false });
    });
  }
});

describe("invalid pagination never hides the rest of the book", () => {
  it("a first page that does not say its limit is refused, not served as the whole book", async () => {
    // Sixty listings at fifty a page. The CRM echoes its cap as `limit` and
    // the loop reads it back; a first page without one used to be read as
    // "a one-page feed", so PAF0051–PAF0060 were not on the site and nothing
    // said so.
    quiet();
    const book = Array.from({ length: 60 }, (_, i) =>
      feedRow({ reference: "PAF" + String(i + 1).padStart(4, "0") }),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(((url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? 0);
      const page = feedEnvelope(book.slice(offset, offset + 50), { offset });
      return Promise.resolve(
        new Response(JSON.stringify(offset === 0 ? without(page, "limit") : page), { status: 200 }),
      );
    }) as never);
    const r = await getListings();
    expect(r, "fifty rows served as the whole book is the defect").not.toEqual(
      expect.objectContaining({ ok: true, listings: expect.arrayContaining([expect.anything()]) }),
    );
    expect(r).toEqual({ ok: false });
  });

  it("still reads every page of a well-formed book, and stops at the first short one", async () => {
    const book = Array.from({ length: 120 }, (_, i) =>
      feedRow({ reference: "PAF" + String(i + 1).padStart(4, "0") }),
    );
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(((url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? 0);
      return Promise.resolve(
        new Response(JSON.stringify(feedEnvelope(book.slice(offset, offset + 50), { offset })), {
          status: 200,
          headers: { etag: 'W/"snapA-d' + offset + '"' },
        }),
      );
    }) as never);
    const r = await getListings();
    expect(r.ok && r.listings.length).toBe(120);
    expect(f.mock.calls.length, "two full pages and the short third").toBe(3);
  });
});

describe("what a refusal writes to the log", () => {
  it("names the path and the kind of problem, and nothing the row contained", async () => {
    const err = quiet();
    serve(
      feedEnvelope([
        feedRow({
          title: { en: { text: "SECRET-TITLE" } },
          public_description: { en: "SECRET-DESCRIPTION" },
        }),
      ]),
    );
    await getListings();
    expect(err).toHaveBeenCalled();
    const logged = err.mock.calls
      .map((args) =>
        args
          .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      )
      .join("\n");
    expect(logged, "the path is the magnet").toMatch(/listings\.0\.title\.en/);
    for (const secret of ["SECRET-TITLE", "SECRET-DESCRIPTION", "thumb.jpg", "Peyia", "450000", "pool terrace"]) {
      expect(logged, `the log must not carry ${secret}`).not.toContain(secret);
    }
  });
});
