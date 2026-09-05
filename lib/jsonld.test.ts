import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { listingBreadcrumbs, listingJsonLd } from "./jsonld";

/**
 * The structured data is the copy of the page nobody reads.
 *
 * Which is exactly why it needs a test: the visible table on a development was
 * corrected to withhold the container's beds, baths and areas and to price it
 * "from", and the JSON-LD twelve lines below it went on publishing floorSize
 * 300 m², numberOfBedrooms 5 and a firm Offer of 800,000 InStock. Nothing on
 * the rendered page showed it, so nothing but a test can catch it coming back.
 *
 * The fixtures are the two real records — PAF0002, the six-villa development
 * whose container fields describe no dwelling, and PAF0001, a completed resale
 * villa where every one of those fields is true.
 */

/** PAF0002 as it actually is: container 5 bed / 5 bath / 300 m², villas 4/4/250. */
const development = {
  reference: "PAF0002",
  kind: "project",
  property_type: "villa",
  transaction_type: "sale",
  title: { en: "Coral Bay Villas" },
  short_description: { en: "Six villas above Coral Bay." },
  public_description: null,
  district: { en: "Paphos" },
  area: { en: "Peyia" },
  currency: "EUR",
  asking_price: 800000,
  bedrooms: 5,
  bathrooms: 5,
  covered_area_sqm: 300,
  images: [{ card: "https://cdn.example/paf0002-card.jpg", thumb: null, is_cover: true }],
} as unknown as Listing;

/** PAF0001 as it actually is: one dwelling, whose own figures are its own. */
const villa = {
  reference: "PAF0001",
  kind: "standalone",
  property_type: "villa",
  transaction_type: "sale",
  title: { en: "Sea-view villa, Coral Bay" },
  short_description: { en: "A three-bedroom villa." },
  public_description: null,
  district: { en: "Paphos" },
  area: { en: "Peyia" },
  currency: "EUR",
  asking_price: 450000,
  bedrooms: 3,
  bathrooms: 3,
  covered_area_sqm: 185,
  images: [{ card: "https://cdn.example/paf0001-card.jpg", thumb: null, is_cover: true }],
} as unknown as Listing;

describe("a development publishes no more than its page shows", () => {
  const ld = listingJsonLd(development);

  it("withholds floorSize, because 300 m² is the container's number and no villa's", () => {
    expect(ld).not.toHaveProperty("floorSize");
  });

  it("withholds numberOfBedrooms, because the units carry 4 and the container says 5", () => {
    expect(ld).not.toHaveProperty("numberOfBedrooms");
  });

  it("states the price as a minimum, not as a price anything is for sale at", () => {
    const offers = ld.offers as Record<string, unknown>;
    expect(offers).toBeDefined();
    // `price` is a firm figure to every consumer that reads it. The site says
    // "from €800,000"; this is the machine-readable way to say the same thing.
    expect(offers.price).toBeUndefined();
    expect(offers.priceSpecification).toEqual({
      "@type": "PriceSpecification",
      minPrice: 800000,
      priceCurrency: "EUR",
    });
  });

  it("still says what it is — the name falls back to a line that says development", () => {
    // The title is set here, so check the fallback path the same way the page
    // does: a container with no title is named by placeLine.
    const untitled = { ...development, title: null } as unknown as Listing;
    expect(listingJsonLd(untitled).name).toBe("Villa development in Peyia, Paphos");
  });
});

describe("a dwelling publishes everything it owns", () => {
  const ld = listingJsonLd(villa);

  it("carries its covered area, because a villa's 185 m² is the villa's", () => {
    expect(ld.floorSize).toEqual({
      "@type": "QuantitativeValue",
      value: 185,
      unitCode: "MTK",
    });
  });

  it("carries its bedrooms", () => {
    expect(ld.numberOfBedrooms).toBe(3);
  });

  it("states a firm price, because there is one", () => {
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe(450000);
    expect(offers.priceCurrency).toBe("EUR");
    expect(offers).not.toHaveProperty("priceSpecification");
  });
});

describe("every URL it emits is absolute", () => {
  it("because a relative one is undefined behaviour away from this page", () => {
    expect(listingJsonLd(villa).url).toBe("https://gnk-web.vercel.app/properties/PAF0001");
    const crumbs = listingBreadcrumbs(villa).itemListElement;
    for (const crumb of crumbs) {
      expect(String(crumb.item)).toMatch(/^https:\/\//);
    }
    expect(crumbs.map((c) => c.name)).toEqual([
      "Home",
      "Properties",
      "Sea-view villa, Coral Bay",
    ]);
  });
});

describe("a listing with no price", () => {
  it("emits no offer at all rather than an empty one", () => {
    const poa = { ...villa, asking_price: null } as unknown as Listing;
    expect(listingJsonLd(poa)).not.toHaveProperty("offers");
  });
});
