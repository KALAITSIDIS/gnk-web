import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { cardSpecs } from "./format";

/**
 * The one line of measurements on a card, chosen by what the thing IS.
 *
 * The card built its spec line from bedrooms, bathrooms and covered area, so
 * PAF0003 — 980 m² of land at €780,000 — showed a price and nothing else,
 * while its plot area, the only size a plot has, was dropped (audit 2.1). A
 * plot's line is its plot; a dwelling's is beds, baths and covered area; a
 * development's is nothing, because its own figures describe no dwelling
 * anyone can buy (isContainer).
 */
const base = {
  reference: "X",
  kind: "standalone",
  transaction_type: "sale",
  title: { en: "T" },
  district: { en: "Paphos" },
  currency: "EUR",
  asking_price: 1,
} as unknown as Listing;

describe("cardSpecs", () => {
  it("a plot of land shows its plot area, and only that", () => {
    expect(cardSpecs({ ...base, property_type: "land", plot_area_sqm: 980 } as Listing)).toEqual([
      "980 m² plot",
    ]);
  });

  it("a plot with no recorded area shows nothing rather than a blank", () => {
    expect(cardSpecs({ ...base, property_type: "land", plot_area_sqm: null } as Listing)).toEqual([]);
  });

  it("a dwelling shows beds, baths and covered area", () => {
    expect(
      cardSpecs({
        ...base,
        property_type: "villa",
        bedrooms: 3,
        bathrooms: 3,
        covered_area_sqm: 185,
      } as Listing),
    ).toEqual(["3 bed", "3 bath", "185 m²"]);
  });

  it("a studio reads as a studio, not as 0 bed", () => {
    expect(cardSpecs({ ...base, property_type: "apartment", bedrooms: 0, covered_area_sqm: 40 } as Listing)).toEqual([
      "Studio",
      "40 m²",
    ]);
  });

  it("a development shows nothing — its figures belong to its units", () => {
    expect(
      cardSpecs({ ...base, kind: "project", property_type: "villa", bedrooms: 5, covered_area_sqm: 300 } as Listing),
    ).toEqual([]);
  });
});
