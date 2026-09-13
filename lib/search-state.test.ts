import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { activeFilters, parseSearchState, serializeSearchState, sortListings } from "./search";

/**
 * A filtered view is a place a person can be sent back to.
 *
 * Until 2026-09-13 the search bar kept its state in React alone: a filtered
 * view could not be linked, bookmarked, restored on reload, reached with the
 * back button, or seen by anyone reading the logs (audit WEB-04). The state
 * now lives in the URL — `?q&type&beds&max&sort` — and these are the pure
 * halves: reading it back safely, writing only what is not the default, and
 * ordering results without letting a rental's month onto the sale ladder.
 */
const listing = (over: Partial<Listing>): Listing =>
  ({
    reference: "PAF0000",
    kind: "standalone",
    property_type: "villa",
    transaction_type: "sale",
    title: { en: "A" },
    short_description: null,
    public_description: null,
    district: { en: "Paphos" },
    area: null,
    sea_distance_m: null,
    currency: "EUR",
    asking_price: null,
    rent_price_month: null,
    vat_status: null,
    covered_area_sqm: null,
    plot_area_sqm: null,
    veranda_sqm: null,
    roof_garden_sqm: null,
    basement_sqm: null,
    bedrooms: null,
    bathrooms: null,
    wc: null,
    parking_spaces: null,
    has_storage: null,
    floor_number: null,
    total_floors: null,
    year_built: null,
    energy_class: null,
    features: null,
    title_deed_status: null,
    construction_status: null,
    delivery_date: null,
    published_at: null,
    updated_at: null,
    images: null,
    ...over,
  }) as Listing;

describe("reading search state from a URL", () => {
  it("is empty and sorted newest when nothing is given", () => {
    expect(parseSearchState(new URLSearchParams(""))).toEqual({
      q: "",
      type: "",
      beds: "",
      max: "",
      sort: "newest",
    });
  });

  it("takes the four filters and the sort back", () => {
    expect(parseSearchState(new URLSearchParams("q=peyia&type=villa&beds=3&max=500000&sort=price-asc"))).toEqual(
      { q: "peyia", type: "villa", beds: "3", max: "500000", sort: "price-asc" },
    );
  });

  it("refuses what is not a number, a known sort, or a plausible type — the URL is caller text", () => {
    const s = parseSearchState(
      new URLSearchParams("beds=three&max=1e9&sort=cheapest&type=<script>&q=" + "x".repeat(300)),
    );
    expect(s.beds).toBe("");
    expect(s.max).toBe("");
    expect(s.sort).toBe("newest");
    expect(s.type).toBe("");
    expect(s.q.length).toBeLessThanOrEqual(120);
  });
});

describe("writing search state to a URL", () => {
  it("writes nothing for the default state, so the clean URL stays clean", () => {
    expect(serializeSearchState(parseSearchState(new URLSearchParams("")))).toBe("");
  });

  it("writes only what differs from the default, in a stable order", () => {
    expect(serializeSearchState({ q: "", type: "villa", beds: "", max: "500000", sort: "price-desc" })).toBe(
      "type=villa&max=500000&sort=price-desc",
    );
  });

  it("round-trips", () => {
    const qs = "q=coral+bay&type=apartment&beds=2&max=750000&sort=price-asc";
    expect(serializeSearchState(parseSearchState(new URLSearchParams(qs)))).toBe(qs);
  });
});

describe("sorting", () => {
  const cheap = listing({ reference: "CHEAP", asking_price: 285_000 });
  const dear = listing({ reference: "DEAR", asking_price: 780_000 });
  const mid = listing({ reference: "MID", asking_price: 450_000 });
  const rental = listing({ reference: "RENT", transaction_type: "rent", rent_price_month: 1_500 });
  const poa = listing({ reference: "POA", asking_price: null });
  const feed = [dear, rental, mid, poa, cheap]; // the feed's own order: newest first

  it("newest keeps the feed's order untouched", () => {
    expect(sortListings(feed, "newest").map((l) => l.reference)).toEqual(["DEAR", "RENT", "MID", "POA", "CHEAP"]);
  });

  it("price ascending orders by the sale figure and keeps the unpriced and the rentals at the end, in feed order", () => {
    // A rental's €1,500 is a month, not a price: it must not sort as the
    // cheapest property for sale (the rule the ladder already follows).
    expect(sortListings(feed, "price-asc").map((l) => l.reference)).toEqual(["CHEAP", "MID", "DEAR", "RENT", "POA"]);
  });

  it("price descending is the mirror, with the same tail", () => {
    expect(sortListings(feed, "price-desc").map((l) => l.reference)).toEqual(["DEAR", "MID", "CHEAP", "RENT", "POA"]);
  });

  it("does not mutate the input", () => {
    const copy = [...feed];
    sortListings(feed, "price-asc");
    expect(feed).toEqual(copy);
  });
});

describe("the chips a person can remove", () => {
  it("is empty for the default state", () => {
    expect(activeFilters(parseSearchState(new URLSearchParams("")))).toEqual([]);
  });

  it("names each active filter in the words the controls use, and never the sort", () => {
    const chips = activeFilters({ q: "peyia", type: "villa", beds: "3", max: "500000", sort: "price-asc" });
    expect(chips).toEqual([
      { key: "q", label: "“peyia”" },
      { key: "type", label: "Villa" },
      { key: "beds", label: "3+ bedrooms" },
      { key: "max", label: "Up to €500k" },
    ]);
  });
});
