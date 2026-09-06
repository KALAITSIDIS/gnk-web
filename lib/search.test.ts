import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { priceLabel } from "@/lib/format";
import {
  bedroomOptionsFor,
  matchesBedrooms,
  matchesMaxPrice,
  priceStepsFor,
  salePrice,
} from "./search";

/** The three properties actually published on 2026-09-05. */
const LIVE = [285_000, 450_000, 780_000];

describe("a price step has to be able to return something", () => {
  it("drops a step below the cheapest listing", () => {
    // The live bar offered "Up to €250k" against a cheapest of €285,000, so
    // choosing it could only ever produce "Nothing here matches that yet".
    expect(priceStepsFor(LIVE)).not.toContain(250_000);
  });

  it("keeps the steps that genuinely divide the book", () => {
    expect(priceStepsFor(LIVE)).toEqual([500_000, 750_000]);
  });

  it("drops a step at or above the dearest, which would filter nothing out", () => {
    expect(priceStepsFor([100_000, 200_000])).toEqual([]);
    expect(priceStepsFor(LIVE)).not.toContain(1_000_000);
  });

  it("offers nothing at all for a single listing", () => {
    expect(priceStepsFor([450_000])).toEqual([]);
    expect(priceStepsFor([])).toEqual([]);
  });

  it("offers nothing when every listing costs the same", () => {
    // Six villas at €800,000 — the PAF0002 development, if its units were ever
    // published individually. No step can divide them.
    expect(priceStepsFor([800_000, 800_000, 800_000])).toEqual([]);
  });

  it("every step it offers includes at least one and excludes at least one", () => {
    for (const prices of [LIVE, [95_000, 4_000_000], [300_000, 600_000, 900_000, 3_000_000]]) {
      for (const step of priceStepsFor(prices)) {
        expect(prices.some((p) => p <= step), `${step} includes nothing`).toBe(true);
        expect(prices.some((p) => p > step), `${step} excludes nothing`).toBe(true);
      }
    }
  });
});

/** PAF0002 as it is: a project whose own 5 describes none of its six 4-bed villas. */
const development = { reference: "PAF0002", kind: "project", bedrooms: 5 } as unknown as Listing;
const villa = { reference: "PAF0001", kind: "standalone", bedrooms: 3 } as unknown as Listing;
const flat = { reference: "PAF0004", kind: "standalone", bedrooms: 2 } as unknown as Listing;

describe("the bedroom control never reads a development's own count", () => {
  it("offers no option built from a container", () => {
    // The live bar was offering "5+" on the strength of PAF0002's container
    // row — a step that could only match the development itself, whose page
    // prints no bedroom count at all. Every other surface was gated that day;
    // this one was still reading the raw field.
    expect(bedroomOptionsFor([development, villa, flat])).toEqual([2, 3]);
  });

  it("never lets a container satisfy a bedroom filter, however low", () => {
    expect(matchesBedrooms(development, "4")).toBe(false);
    expect(matchesBedrooms(development, "1")).toBe(false);
  });

  it("leaves a container in the results when no bedroom filter is set", () => {
    // It is still found by type, price and text; only this control ignores it.
    expect(matchesBedrooms(development, "")).toBe(true);
  });

  it("keeps ordinary minimum-bedroom semantics for a dwelling", () => {
    expect(matchesBedrooms(villa, "3")).toBe(true);
    expect(matchesBedrooms(villa, "4")).toBe(false);
    expect(matchesBedrooms(flat, "")).toBe(true);
  });

  it("dedupes and sorts what it does offer", () => {
    const twin = { ...villa, reference: "PAF0009" } as unknown as Listing;
    expect(bedroomOptionsFor([villa, flat, twin])).toEqual([2, 3]);
  });
});

describe("a step exactly at a listing's price", () => {
  it("is offered, because 'up to' includes it — and a step at the dearest is not", () => {
    // Boundaries were never exercised: >= the cheapest keeps a step equal to
    // the cheapest, < the dearest drops one equal to the dearest.
    expect(priceStepsFor([250_000, 900_000])).toContain(250_000);
    expect(priceStepsFor([300_000, 750_000])).not.toContain(750_000);
  });
});

const sale = (asking_price: number | null) =>
  ({ kind: "standalone", transaction_type: "sale", asking_price, rent_price_month: null }) as unknown as Listing;
/** No rental is published today; this is the first one, at a plausible Paphos rent. */
const rental = {
  kind: "standalone",
  transaction_type: "rent",
  asking_price: null,
  rent_price_month: 1_500,
} as unknown as Listing;

describe("a rental's month is not a rung on the sale ladder", () => {
  const book = [rental, ...LIVE.map((p) => sale(p))];
  const ladderInputs = (ls: Listing[]) => ls.map(salePrice).filter((p): p is number => !!p);

  it("contributes no price, so it cannot drag the ladder down to a step no sale can match", () => {
    // Read inline, 1,500 joined the array and "Up to €250k" came back — the
    // step removed because no sale is that cheap — returning the rental alone
    // beneath it, on a card that reads "/ month".
    expect(ladderInputs(book)).toEqual(LIVE);
    expect(priceStepsFor(ladderInputs(book))).not.toContain(250_000);
  });

  it("satisfies no ceiling, however high", () => {
    expect(matchesMaxPrice(rental, "500000")).toBe(false);
    expect(matchesMaxPrice(rental, "5000000")).toBe(false);
  });

  it("is still in the results when no ceiling is set", () => {
    expect(matchesMaxPrice(rental, "")).toBe(true);
  });

  it("agrees with the card: what has no sale price is priced per month", () => {
    expect(salePrice(rental)).toBeNull();
    expect(priceLabel(rental)).toBe("€1,500 / month");
  });

  it("keeps ordinary ceiling semantics for a sale, and lets price-on-application through", () => {
    expect(matchesMaxPrice(sale(450_000), "500000")).toBe(true);
    expect(matchesMaxPrice(sale(780_000), "500000")).toBe(false);
    expect(matchesMaxPrice(sale(null), "500000")).toBe(true);
  });
});

describe("a studio is a dwelling with no bedroom, not a dwelling with no bedroom count", () => {
  const studio = {
    kind: "standalone",
    property_type: "apartment",
    transaction_type: "sale",
    asking_price: 120_000,
    bedrooms: 0,
  } as unknown as Listing;
  const three = { ...studio, bedrooms: 3 } as Listing;

  it("offers no '0+' option, because that is 'any bedrooms'", () => {
    expect(bedroomOptionsFor([studio, three])).toEqual([3]);
  });

  it("fails a 1+ filter and passes no filter", () => {
    expect(matchesBedrooms(studio, "1")).toBe(false);
    expect(matchesBedrooms(studio, "")).toBe(true);
  });
});

describe("a listing for sale or rent", () => {
  const both = {
    kind: "standalone",
    transaction_type: "sale_or_rent",
    asking_price: 450_000,
    rent_price_month: 1_500,
  } as unknown as Listing;

  it("is on the ladder by its sale price, and under a ceiling by it", () => {
    expect(salePrice(both)).toBe(450_000);
    expect(matchesMaxPrice(both, "500000")).toBe(true);
    expect(matchesMaxPrice(both, "400000")).toBe(false);
  });

  it("agrees with the card, which says both", () => {
    expect(priceLabel(both)).toBe("€450,000 · €1,500 / month");
  });
});
