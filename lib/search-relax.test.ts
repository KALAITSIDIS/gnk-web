import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { DEFAULT_SEARCH, matchesSearch, relaxations, type SearchState } from "./search";

/**
 * When a search finds nothing, the page says which ONE filter stands in the
 * way — and the visitor decides whether to drop it.
 *
 * The empty state used to offer a single way on: a link to the contact page.
 * A buyer who had chosen "Villa" and "Up to €250k" against a book whose
 * cheapest villa is €450,000 was told "Nothing here matches that yet" and
 * nothing about which choice did it. These are the pure halves: the one
 * predicate the grid and the suggestions share, and the list of filters
 * whose removal alone would find something.
 */
const listing = (over: Partial<Listing>): Listing =>
  ({
    kind: "standalone",
    transaction_type: "sale",
    title: { en: "T" },
    district: { en: "Paphos" },
    area: { en: "Peyia / Coral Bay" },
    currency: "EUR",
    images: [],
    features: [],
    ...over,
  }) as unknown as Listing;

/** The book as published on 2026-10-18: an apartment, a plot and a villa. */
const BOOK = [
  listing({ reference: "PAF0004", property_type: "apartment", area: { en: "Kato Paphos" }, asking_price: 285_000, bedrooms: 2 }),
  listing({ reference: "PAF0003", property_type: "land", asking_price: 780_000, plot_area_sqm: 980 }),
  listing({ reference: "PAF0001", property_type: "villa", asking_price: 450_000, bedrooms: 3 }),
];

const search = (over: Partial<SearchState>): SearchState => ({ ...DEFAULT_SEARCH, ...over });
const refs = (s: SearchState) => BOOK.filter((l) => matchesSearch(l, s)).map((l) => l.reference);
const keys = (s: SearchState) => relaxations(BOOK, s).map((r) => r.key);

describe("the one predicate the grid and its suggestions share", () => {
  it("passes everything when nothing is filtering", () => {
    expect(refs(DEFAULT_SEARCH)).toEqual(["PAF0004", "PAF0003", "PAF0001"]);
  });

  it("applies every filter together", () => {
    expect(refs(search({ type: "villa", max: "500000" }))).toEqual(["PAF0001"]);
    expect(refs(search({ type: "villa", max: "250000" }))).toEqual([]);
  });

  it("matches free text against the place, the reference and the title, without case", () => {
    expect(refs(search({ q: "kato" }))).toEqual(["PAF0004"]);
    expect(refs(search({ q: "paf0003" }))).toEqual(["PAF0003"]);
    expect(refs(search({ q: "CORAL" }))).toEqual(["PAF0003", "PAF0001"]);
  });

  it("ignores the sort, which orders and removes nothing", () => {
    expect(refs(search({ sort: "price-desc" }))).toEqual(refs(DEFAULT_SEARCH));
  });
});

describe("which filter to drop when nothing matches", () => {
  it("names the one filter whose removal finds something, and not the one that would not", () => {
    // Villa + up to €250k: without the price the villa is back; without the
    // type, nothing in the book is €250k or under either.
    expect(keys(search({ type: "villa", max: "250000" }))).toEqual(["max"]);
  });

  it("offers every filter that would each find something alone, most productive first", () => {
    // 4+ bedrooms in Kato Paphos: drop the area and nothing has 4 bedrooms;
    // drop the bedrooms and the Kato apartment is back. Typed "zzz" with a
    // type: dropping the text finds the villa, dropping the type finds nothing.
    expect(keys(search({ area: "Kato Paphos", beds: "4" }))).toEqual(["beds"]);
    expect(keys(search({ q: "zzz", type: "villa" }))).toEqual(["q"]);
    // Apartment + Peyia: dropping the area finds the apartment, dropping
    // the type finds the plot and the villa — two, so it comes first.
    expect(keys(search({ type: "apartment", area: "Peyia / Coral Bay" }))).toEqual(["type", "area"]);
  });

  it("keeps the chip order when two suggestions find the same number", () => {
    // Land + 2+ bedrooms: dropping the type finds the apartment and the
    // villa, dropping the bedrooms finds the plot — the type is first by
    // count. Land + Kato Paphos ties at one each, so the chip order holds.
    expect(keys(search({ type: "land", beds: "2" }))).toEqual(["type", "beds"]);
    expect(keys(search({ type: "land", area: "Kato Paphos" }))).toEqual(["type", "area"]);
  });

  it("offers nothing when no single removal would help", () => {
    // Two filters that each exclude the whole book on their own.
    expect(keys(search({ q: "zzz", beds: "9" }))).toEqual([]);
  });

  it("labels each suggestion with the chip's own words, never a count", () => {
    const [only] = relaxations(BOOK, search({ type: "villa", max: "250000" }));
    expect(only).toEqual({ key: "max", label: "Up to €250k" });
  });

  it("only suggests what the grid would then actually show", () => {
    for (const s of [
      search({ type: "villa", max: "250000" }),
      search({ area: "Kato Paphos", beds: "4" }),
      search({ type: "apartment", area: "Peyia / Coral Bay" }),
      search({ q: "zzz", type: "villa" }),
    ]) {
      for (const r of relaxations(BOOK, s)) {
        expect(refs({ ...s, [r.key]: "" }).length, `${r.key} in ${JSON.stringify(s)}`).toBeGreaterThan(0);
      }
    }
  });
});
