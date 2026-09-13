import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { relatedHeading, relatedListings } from "./related";

/**
 * The onward path from a listing.
 *
 * Measured on the live site 2026-09-13: a buyer who reached PAF0001 and
 * decided against it had nowhere to go but the browser's back button. The
 * block picks the closest other listings — same area first, then the same
 * district, then the rest in the feed's own order — and its heading names
 * the narrowest place EVERY card in it shares with the listing, so "Other
 * properties in Peyia / Coral Bay" is never printed above a card in Kato
 * Paphos.
 */
const listing = (reference: string, area: string | null, district = "Paphos"): Listing =>
  ({
    reference,
    kind: "standalone",
    property_type: "villa",
    transaction_type: "sale",
    title: { en: reference },
    district: { en: district },
    area: area ? { en: area } : null,
    currency: "EUR",
    asking_price: 1,
    images: [],
    features: [],
  }) as unknown as Listing;

const peyia1 = listing("PAF0001", "Peyia / Coral Bay");
const peyia3 = listing("PAF0003", "Peyia / Coral Bay");
const kato4 = listing("PAF0004", "Kato Paphos");
const limassol = listing("LIM0001", "Germasogeia", "Limassol");
const unfiled = listing("PAF0009", null);

describe("which listings follow a listing", () => {
  it("never includes the listing itself, whatever the case of its reference", () => {
    const self = { ...peyia1, reference: "paf0001" } as Listing;
    expect(relatedListings(self, [peyia1, peyia3]).map((l) => l.reference)).toEqual(["PAF0003"]);
  });

  it("puts the same area first, then the same district, then the rest, keeping feed order inside a tier", () => {
    const feed = [limassol, kato4, unfiled, peyia3, peyia1];
    expect(relatedListings(peyia1, feed, 5).map((l) => l.reference)).toEqual([
      "PAF0003",
      "PAF0004",
      "PAF0009",
      "LIM0001",
    ]);
  });

  it("stops at the limit, which defaults to three", () => {
    const feed = [limassol, kato4, unfiled, peyia3, peyia1];
    expect(relatedListings(peyia1, feed)).toHaveLength(3);
    expect(relatedListings(peyia1, feed, 1).map((l) => l.reference)).toEqual(["PAF0003"]);
  });

  it("is empty for a book of one", () => {
    expect(relatedListings(peyia1, [peyia1])).toEqual([]);
  });
});

describe("what the block is called", () => {
  it("names the area when every card shares it", () => {
    expect(relatedHeading(peyia1, [peyia3])).toBe("Other properties in Peyia / Coral Bay");
  });

  it("falls back to the district when the cards span areas", () => {
    // The live book: PAF0001's siblings are one in Peyia and one in Kato
    // Paphos, so the honest heading is the district.
    expect(relatedHeading(peyia1, [peyia3, kato4])).toBe("Other properties in Paphos");
  });

  it("names no place when the cards span districts, or when the listing has no area", () => {
    expect(relatedHeading(peyia1, [peyia3, limassol])).toBe("Other properties");
    expect(relatedHeading(unfiled, [peyia3])).toBe("Other properties in Paphos");
  });
});
