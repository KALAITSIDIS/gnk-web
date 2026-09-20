import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { cardSpecs, deliveryLabel, placeLine, priceLabel, pricePerSqm } from "@/lib/format";
import { feedEnvelope, feedRow } from "@/lib/feed-fixtures";
import {
  FEED_IMAGE_KEYS,
  FEED_KEYS,
  feedEnvelopeSchema,
  feedIssueSummary,
  feedProblems,
  feedRowSchema,
  type FeedRow,
} from "@/lib/feed-schema";

/**
 * The feed contract, checked without a network.
 *
 * lib/contract.test.ts asks the LIVE CRM whether it still agrees with us, which
 * is drift detection and cannot be anything else — it needs a running service.
 * THIS file is the correctness half: fixtures for every shape the book actually
 * holds, and for the malformed payloads the site must refuse, run in
 * milliseconds with nothing deployed. Neither replaces the other; before this
 * split, one live request carrying one row was doing both jobs and doing the
 * second one badly.
 */

/* The fixtures live in lib/feed-fixtures.ts, shared with the reader's own
   tests (lib/crm.validation.test.ts, lib/crm.test.ts): one complete row and
   one envelope, so that what this file says the schema accepts is exactly
   what those files feed the reader. */
const row = feedRow;
const envelope = feedEnvelope;

describe("the schema and the site's own type describe the same row", () => {
  it("has the 36 columns the CRM's allowlist pins", () => {
    expect(FEED_KEYS).toHaveLength(36);
  });

  it("IS lib/crm.ts's Listing — one definition, so there is no second list to drift", () => {
    // Until 2026-09-20 this test read `interface Listing` out of lib/crm.ts as
    // text and compared key names. Listing is now z.infer of feedRowSchema;
    // these two lines are the pin, and they are checked by `npm run typecheck`
    // rather than at run time — a parsed row is a Listing and a Listing is a
    // parsed row, or tsc refuses the file.
    const parsedIsListing: Listing = feedRowSchema.parse(row());
    const listingIsParsed: FeedRow = parsedIsListing;
    expect(Object.keys(listingIsParsed).sort()).toEqual([...FEED_KEYS].sort());
  });

  it("describes the image object the site reads, and no more", () => {
    // lib/format.ts coverImage/heroImage read exactly these. gnk-crm RLS test
    // 49 pins the same five on its side; there is deliberately no `is_cover`.
    expect([...FEED_IMAGE_KEYS].sort()).toEqual(["alt", "card", "full", "thumb", "watermarked"]);
  });
});

describe("the shapes the book actually holds", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["a resale villa for sale", {}],
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
      "one offered both ways",
      { reference: "PAF0007", transaction_type: "sale_or_rent", rent_price_month: 2400 },
    ],
    [
      "land",
      {
        reference: "PAF0003",
        property_type: "land",
        bedrooms: null,
        bathrooms: null,
        wc: null,
        covered_area_sqm: null,
        plot_area_sqm: 980,
        year_built: null,
        total_floors: null,
        construction_status: null,
        energy_class: null,
        features: null,
        images: [],
      },
    ],
    [
      "a development, whose own fields describe no dwelling",
      {
        reference: "PAF0002",
        kind: "project",
        asking_price: 800000,
        year_built: null,
        construction_status: "finishing",
        delivery_date: "2099-10-01",
      },
    ],
    ["a phase of one", { reference: "PAF0002-P1", kind: "phase", delivery_date: "2099-10-01" }],
    ["a studio, whose defining fact is bedrooms 0", { reference: "PAF0008", bedrooms: 0 }],
    ["a listing with no photographs yet", { images: [] }],
    ["a listing whose photographs are null, not empty", { images: null }],
    [
      "a photograph with no alt text written, as the CRM leaves it",
      { images: [{ thumb: "a", card: "b", full: "c", alt: {}, watermarked: false }] },
    ],
    [
      "a pre-0073 feed, whose renditions have not all been built",
      { images: [{ thumb: null, card: "b", full: null, alt: null, watermarked: false }] },
    ],
    ["price on application — every price null", { asking_price: null, rent_price_month: null }],
  ];

  for (const [name, over] of cases) {
    it(`accepts ${name}`, () => {
      expect(feedProblems(envelope([row(over)])), name).toEqual([]);
    });
  }

  it("accepts a pre-0085 feed, which carries no adviser view at all", () => {
    // `adviser_view` joined the allowlist at 0085; a database that has not run
    // it does not send the key, and an absent view is the same as an empty one.
    const old = row();
    delete (old as Record<string, unknown>).adviser_view;
    expect(Object.keys(old)).toHaveLength(35);
    expect(feedProblems(envelope([old]))).toEqual([]);
  });

  it("accepts a column the CRM adds later, rather than refusing the whole book", () => {
    // An additive change on the producer's side must not take the site down.
    // The live drift check in lib/contract.test.ts is what NOTICES it; this is
    // what makes noticing survivable.
    expect(feedProblems(envelope([row({ energy_rating_kwh: 95 })]))).toEqual([]);
    expect(feedProblems(envelope([row()], { next_offset: 50 }))).toEqual([]);
  });

  it("accepts a vocabulary value it has never seen", () => {
    // property_type, kind, vat_status and the rest are CRM-side enums. Adding
    // one is the CRM's business; refusing it here would be the site's mistake.
    expect(feedProblems(envelope([row({ property_type: "townhouse", kind: "unit" })]))).toEqual([]);
  });
});

describe("what the site must refuse, and why", () => {
  const rejects: [string, unknown, RegExp][] = [
    ["a row with no reference — it is the URL and the sitemap entry", envelope([row({ reference: undefined })]), /reference/],
    ["a reference that is empty", envelope([row({ reference: "" })]), /reference/],
    // the reader used to trim and drop such a row itself; the guard is the schema's now
    ["a reference that is blank", envelope([row({ reference: "   " })]), /reference/],
    [
      "a price arriving as a string — the coercion nobody would notice",
      envelope([row({ asking_price: "450000.00" })]),
      /asking_price/,
    ],
    ["a bedroom count that is not whole", envelope([row({ bedrooms: 2.5 })]), /bedrooms/],
    ["a multilingual field sent as a bare string", envelope([row({ title: "Villa" })]), /title/],
    ["features sent as one comma-joined string", envelope([row({ features: "sea_view,pool" })]), /features/],
    ["images sent as an object instead of an array", envelope([row({ images: { card: "a" } })]), /images/],
    [
      "an image missing the rendition the grid uses",
      envelope([row({ images: [{ thumb: "a", full: "c" }] })]),
      /images\.0\.card/,
    ],
    [
      "a delivery date sent as an instant — it is a `date` column",
      envelope([row({ delivery_date: "2099-10-01T00:00:00+00:00" })]),
      /delivery_date/,
    ],
    ["an envelope with no listings array", { org: "gnk", count: 0, limit: 50, offset: 0 }, /listings/],
    ["listings sent as null", envelope(null as unknown as unknown[]), /listings/],
    [
      "a limit of zero — the paging loop reads this to know the page size",
      envelope([row()], { limit: 0 }),
      /limit/,
    ],
    ["a limit sent as a string", envelope([row()], { limit: "50" }), /limit/],
    ["a negative offset", envelope([row()], { offset: -1 }), /offset/],
    ["an envelope that is not an object at all", "<html>502 Bad Gateway</html>", /root/],
  ];

  for (const [name, payload, reason] of rejects) {
    it(`refuses ${name}`, () => {
      const problems = feedProblems(payload);
      expect(problems.length, `${name}: expected a complaint`).toBeGreaterThan(0);
      expect(problems.join(" | "), name).toMatch(reason);
    });
  }

  it("names the ROW that is wrong, not just that something is", () => {
    // A book of fifty with one bad row is a needle; the path is the magnet.
    const problems = feedProblems(envelope([row(), row({ reference: "PAF0002", asking_price: "x" })]));
    expect(problems.join(" | ")).toMatch(/listings\.1\.asking_price/);
  });

  it("gives the reader a log line of paths and codes, capped, and never a value", () => {
    // What lib/crm.ts writes when it refuses a payload. The payload here
    // carries a marker in every field that a careless summary might quote.
    const bad = envelope(
      [row({ title: { en: { text: "MARKER-TITLE" } }, asking_price: "MARKER-PRICE", public_description: { en: "MARKER-BODY" } })],
      { limit: "MARKER-LIMIT" },
    );
    const parsed = feedEnvelopeSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const line = feedIssueSummary(parsed.error);
    expect(line).toMatch(/limit: invalid_type/);
    expect(line).toMatch(/listings\.0\.title\.en: invalid_type/);
    expect(line).toMatch(/listings\.0\.asking_price: invalid_type/);
    expect(line).not.toMatch(/MARKER/);
    // and a payload wrong in many places is summarised, not dumped
    const many = envelope([row(Object.fromEntries(FEED_KEYS.map((k) => [k, {}])))]);
    const manyParsed = feedEnvelopeSchema.safeParse(many);
    if (manyParsed.success) return expect.fail("a row of empty objects must not parse");
    expect(feedIssueSummary(manyParsed.error, 3).split(";")).toHaveLength(4);
    expect(feedIssueSummary(manyParsed.error, 3)).toMatch(/\+\d+ more$/);
  });
});

describe("a row that satisfies the contract is a row the site can render", () => {
  // The contract is only worth having if it guarantees something downstream.
  // These are the four functions that turn a row into what a buyer reads.
  const render = (r: unknown) => {
    const l = feedRowSchema.parse(r) as unknown as Listing;
    return [priceLabel(l), placeLine(l), pricePerSqm(l), cardSpecs(l).join(", "), deliveryLabel(l)];
  };

  it("renders a sale, a rental, land and a development without throwing", () => {
    expect(render(row())[0]).toBe("€450,000");
    expect(render(row({ transaction_type: "rent", asking_price: null, rent_price_month: 1750 }))[0]).toBe(
      "€1,750 / month",
    );
    expect(render(row({ property_type: "land", plot_area_sqm: 980 }))[3]).toBe("980 m² plot");
    const dev = render(row({ kind: "project", year_built: null, construction_status: "finishing", delivery_date: "2099-10-01" }));
    expect(dev[0], "a development prices FROM").toBe("from €450,000");
    expect(dev[2], "and has no €/m², being two unrelated numbers").toBeNull();
    expect(dev[4]).toBe("1 October 2099");
  });

  it("renders a listing with no photographs and no prices", () => {
    const l = feedRowSchema.parse(
      row({ images: [], asking_price: null, rent_price_month: null }),
    ) as unknown as Listing;
    expect(priceLabel(l)).toBe("Price on application");
  });
});

describe("the envelope of a single-reference lookup (gnk-crm 0088)", () => {
  it("carries the reference it was asked for, and one row", () => {
    expect(
      feedProblems({ org: "gnk", count: 1, limit: 50, offset: 0, reference: "PAF0001", listings: [row()] }),
    ).toEqual([]);
  });

  it("is still well formed when the reference matched nothing", () => {
    const parsed = feedEnvelopeSchema.safeParse({
      org: "gnk",
      count: 0,
      limit: 50,
      offset: 0,
      reference: "PAF9999",
      listings: [],
    });
    expect(parsed.success).toBe(true);
  });
});
