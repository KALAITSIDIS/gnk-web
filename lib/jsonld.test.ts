import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import { site } from "@/lib/site";
import { listingBreadcrumbs, listingJsonLd, organizationJsonLd } from "./jsonld";

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
 * villa where every one of those fields is true — plus the shapes no record
 * has yet: a rental, a listing for sale or rent, and a studio. Those exist
 * here BEFORE the first such listing publishes, because that is the only
 * moment a wrong rendering can be caught by anything but a buyer.
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
  images: [{ card: "https://cdn.example/paf0002-card.jpg", thumb: null }],
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
  year_built: 2007,
  published_at: "2026-09-01T10:00:00Z",
  images: [{ card: "https://cdn.example/paf0001-card.jpg", thumb: null }],
} as unknown as Listing;

const entity = (l: Listing) => listingJsonLd(l).mainEntity as Record<string, unknown>;

describe("a development publishes no more than its page shows", () => {
  const ld = listingJsonLd(development);

  it("withholds floorSize, because 300 m² is the container's number and no villa's", () => {
    expect(JSON.stringify(ld)).not.toContain("floorSize");
  });

  it("withholds numberOfBedrooms, because the units carry 4 and the container says 5", () => {
    expect(JSON.stringify(ld)).not.toContain("numberOfBedrooms");
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

  it("is a Place, not a dwelling of its units' type", () => {
    expect(entity(development)["@type"]).toBe("Place");
  });

  it("still says what it is — the name falls back to a line that says development", () => {
    // The title is set here, so check the fallback path the same way the page
    // does: a container with no title is named by placeLine.
    const untitled = { ...development, title: null } as unknown as Listing;
    expect(listingJsonLd(untitled).name).toBe("Villa development in Peyia, Paphos");
  });
});

describe("a dwelling publishes everything it owns, on the dwelling", () => {
  const ld = listingJsonLd(villa);
  const main = entity(villa);

  it("is a SingleFamilyResidence, because it is a villa", () => {
    expect(main["@type"]).toBe("SingleFamilyResidence");
  });

  it("carries its covered area, because a villa's 185 m² is the villa's", () => {
    expect(main.floorSize).toEqual({ "@type": "QuantitativeValue", value: 185, unitCode: "MTK" });
  });

  it("carries its bedrooms, bathrooms and year built", () => {
    expect(main.numberOfBedrooms).toBe(3);
    expect(main.numberOfBathroomsTotal).toBe(3);
    expect(main.yearBuilt).toBe(2007);
  });

  it("keeps the dwelling facts off the page object — they describe the villa, not the URL", () => {
    expect(ld).not.toHaveProperty("floorSize");
    expect(ld).not.toHaveProperty("numberOfBedrooms");
    expect(ld).not.toHaveProperty("address");
    expect(main.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Peyia",
      addressRegion: "Paphos",
      addressCountry: "CY",
    });
  });

  it("states a firm price to Sell, because there is one", () => {
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe(450000);
    expect(offers.priceCurrency).toBe("EUR");
    expect(offers.businessFunction).toBe("http://purl.org/goodrelations/v1#Sell");
    expect(offers).not.toHaveProperty("priceSpecification");
  });

  it("dates the listing from the feed's published_at", () => {
    expect(ld.datePosted).toBe("2026-09-01T10:00:00Z");
  });
});

describe("the entity's type comes from property_type and is never House by default", () => {
  const typed = (property_type: string) => entity({ ...villa, property_type } as Listing)["@type"];

  it("maps the dwelling types", () => {
    expect(typed("apartment")).toBe("Apartment");
    expect(typed("villa")).toBe("SingleFamilyResidence");
    expect(typed("house")).toBe("House");
    expect(typed("townhouse")).toBe("House");
  });

  it("calls land and commercial a Place, which asserts nothing about what stands on it", () => {
    for (const t of ["land", "shop", "office", "building", "hotel", "warehouse", "mixed_use", "other"]) {
      expect(typed(t), t).toBe("Place");
    }
  });

  it("calls a type it has never heard of a Place, not a House", () => {
    expect(typed("castle")).toBe("Place");
  });
});

describe("a rental is offered per month, never as a price", () => {
  const rental = {
    ...villa,
    reference: "PAF0009",
    property_type: "apartment",
    transaction_type: "rent",
    asking_price: null,
    rent_price_month: 1500,
  } as unknown as Listing;
  const offers = listingJsonLd(rental).offers as Record<string, unknown>;

  it("is an Offer to LeaseOut", () => {
    expect(offers.businessFunction).toBe("http://purl.org/goodrelations/v1#LeaseOut");
  });

  it("carries the month as a UnitPriceSpecification, and no bare price", () => {
    // `price: 1500` on an Offer is €1,500 outright to everything that reads it.
    expect(offers.price).toBeUndefined();
    expect(offers.priceSpecification).toEqual({
      "@type": "UnitPriceSpecification",
      price: 1500,
      priceCurrency: "EUR",
      unitCode: "MON",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    });
  });

  it("ignores a stray asking_price on a rental, as the card does", () => {
    const stray = { ...rental, asking_price: 999999 } as Listing;
    const o = listingJsonLd(stray).offers as Record<string, unknown>;
    expect(o.businessFunction).toBe("http://purl.org/goodrelations/v1#LeaseOut");
    expect(JSON.stringify(o)).not.toContain("999999");
  });
});

describe("a listing for sale or rent carries both offers", () => {
  const both = { ...villa, transaction_type: "sale_or_rent", rent_price_month: 1500 } as Listing;
  const offers = listingJsonLd(both).offers as Record<string, unknown>[];

  it("as an array of two, sale first", () => {
    expect(Array.isArray(offers)).toBe(true);
    expect(offers.map((o) => o.businessFunction)).toEqual([
      "http://purl.org/goodrelations/v1#Sell",
      "http://purl.org/goodrelations/v1#LeaseOut",
    ]);
    expect(offers[0]!.price).toBe(450000);
    expect((offers[1]!.priceSpecification as Record<string, unknown>).price).toBe(1500);
  });
});

describe("a studio", () => {
  it("has numberOfBedrooms 0 — present, not missing", () => {
    const studio = { ...villa, property_type: "apartment", bedrooms: 0 } as Listing;
    expect(entity(studio).numberOfBedrooms).toBe(0);
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

  it("treats zero as no price, as the card does", () => {
    const zero = { ...villa, asking_price: 0 } as unknown as Listing;
    expect(listingJsonLd(zero)).not.toHaveProperty("offers");
  });
});

describe("the organisation says where it is from the same fields the footer prints", () => {
  it("carries the locality from lib/site.ts and nowhere else", () => {
    const ld = organizationJsonLd();
    expect(ld["@type"]).toBe("Organization");
    expect(ld.address.addressLocality).toBe(site.contact.locality);
    expect(ld.address.addressCountry).toBe(site.contact.countryCode);
    expect(ld.areaServed).toEqual({ "@type": "AdministrativeArea", name: site.contact.city });
  });

  it("has no street while lib/site.ts has none — the footer's null is this null", () => {
    const noStreet = { ...site, contact: { ...site.contact, street: null } };
    expect(organizationJsonLd(noStreet).address).not.toHaveProperty("streetAddress");
  });

  it("gains the street the day lib/site.ts has one, without another edit", () => {
    const withStreet = { ...site, contact: { ...site.contact, street: "1 Example Street" } };
    expect(organizationJsonLd(withStreet).address.streetAddress).toBe("1 Example Street");
  });

  it("never declares the regulated type", () => {
    // RealEstateAgent is a machine-readable claim of a licence the firm does
    // not hold. lib/site.ts holds null registration numbers for that reason.
    expect(JSON.stringify(organizationJsonLd())).not.toContain("RealEstateAgent");
  });
});
