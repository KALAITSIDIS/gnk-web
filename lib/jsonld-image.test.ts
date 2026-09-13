import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { listingJsonLd } from "./jsonld";

/**
 * A listing with no photographs says nothing about images, rather than
 * asserting an empty list: `"image": []` is valid JSON-LD that a validator
 * reads as "an image property with no value", which is noise on every
 * unphotographed listing and a wrong statement the day one photograph lands
 * in a stale render (audit 4.3).
 */
const base = {
  reference: "PAF0003",
  kind: "standalone",
  property_type: "land",
  transaction_type: "sale",
  title: { en: "Land in Sea Caves" },
  district: { en: "Paphos" },
  area: { en: "Peyia / Coral Bay" },
  currency: "EUR",
  asking_price: 780_000,
  plot_area_sqm: 980,
} as unknown as Listing;

describe("the image property", () => {
  it("is absent when the listing has no photographs", () => {
    expect(listingJsonLd({ ...base, images: [] } as Listing)).not.toHaveProperty("image");
    expect(listingJsonLd({ ...base, images: null } as Listing)).not.toHaveProperty("image");
  });

  it("lists the card renditions when it has them", () => {
    const ld = listingJsonLd({
      ...base,
      images: [{ card: "https://cdn.example/a.webp", thumb: null }, { card: null, thumb: null }],
    } as Listing);
    expect(ld.image).toEqual(["https://cdn.example/a.webp"]);
  });
});
