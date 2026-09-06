import type { Listing } from "@/lib/crm";
import type { PROPERTY_TYPES } from "@/lib/enquiry-fields";
import {
  bedroomsOf,
  CURRENCY,
  isContainer,
  placeLine,
  pricing,
  text,
  titleOf,
  yearBuiltLabel,
} from "@/lib/format";
import { site } from "@/lib/site";
import { absolute, SITE_URL } from "@/lib/site-url";

/**
 * Who this firm is, for machines.
 *
 * TYPE CHOICE IS DELIBERATE AND LOAD-BEARING. schema.org offers
 * `RealEstateAgent`, which is what a Cyprus property firm would normally
 * declare — and this firm is NOT registered or licensed under the Real Estate
 * Agents Law 71(I)/2010. Declaring that type is a machine-readable assertion of
 * exactly the status lib/site.ts holds null registration numbers to avoid
 * claiming in prose. `Organization` is accurate and asserts nothing regulated.
 *
 * Every value comes from lib/site.ts — the same fields the footer prints, so
 * the two cannot disagree. The address is the locality the footer already
 * shows, plus a street only when site.contact.street has one: the same null
 * gates both. (The component that held this used to say "no address" in its
 * comment while emitting a PostalAddress with literals of its own.)
 */
export function organizationJsonLd(firm: typeof site = site) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: firm.name,
    alternateName: firm.shortName,
    url: SITE_URL,
    description: firm.positioning,
    email: firm.contact.email,
    telephone: firm.contact.phone,
    areaServed: { "@type": "AdministrativeArea", name: firm.contact.city },
    address: {
      "@type": "PostalAddress",
      ...(firm.contact.street ? { streetAddress: firm.contact.street } : {}),
      addressLocality: firm.contact.locality,
      addressCountry: firm.contact.countryCode,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: firm.contact.email,
      telephone: firm.contact.phone,
      areaServed: firm.contact.countryCode,
      availableLanguage: ["en"],
    },
  };
}

type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * What the thing on the page IS, in schema.org's terms, from the CRM's
 * property_type and nothing else.
 *
 * Typed against the CRM's enum (lib/enquiry-fields.ts pins the list to the
 * CRM's), so a new type there is a compile error here rather than a silent
 * default. NEVER `House` by default: a plot, a shop and an hotel are not
 * houses, and a dwelling type schema.org does not distinguish is still a
 * dwelling — `Accommodation` says that and no more. Anything the enum does
 * not know is a `Place`, which asserts nothing about what stands on it.
 */
const MAIN_ENTITY_TYPE: Record<PropertyType, string> = {
  apartment: "Apartment",
  villa: "SingleFamilyResidence",
  townhouse: "House",
  house: "House",
  land: "Place",
  shop: "Place",
  office: "Place",
  building: "Place",
  hotel: "Place",
  warehouse: "Place",
  mixed_use: "Place",
  other: "Place",
};

function mainEntityType(l: Listing): string {
  // A development is not one dwelling of any type; it is a place with units.
  if (isContainer(l)) return "Place";
  return (MAIN_ENTITY_TYPE as Record<string, string>)[l.property_type] ?? "Place";
}

const IN_STOCK = "https://schema.org/InStock";
const SELL = "http://purl.org/goodrelations/v1#Sell";
const LEASE_OUT = "http://purl.org/goodrelations/v1#LeaseOut";

/**
 * The offer(s), from the ONE pricing every surface reads (lib/format.ts).
 *
 * A sale is an Offer to Sell with a firm price — or, on a development, a
 * PriceSpecification whose minPrice says "from" the way the card does, because
 * `price` is a figure every consumer treats as transactable and a development's
 * asking_price is the lowest of its units. A rental is an Offer to LeaseOut
 * priced per MONTH through a UnitPriceSpecification: an Offer with `price:
 * 1500` would be read as €1,500 outright by everything that reads it. A
 * listing offered both ways carries both offers.
 */
function offersFor(l: Listing): Record<string, unknown>[] {
  const p = pricing(l);
  const offers: Record<string, unknown>[] = [];
  if (p.sale) {
    offers.push({
      "@type": "Offer",
      businessFunction: SELL,
      priceCurrency: CURRENCY,
      availability: IN_STOCK,
      ...(p.from
        ? {
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: p.sale,
              priceCurrency: CURRENCY,
            },
          }
        : { price: p.sale }),
    });
  }
  if (p.rent) {
    offers.push({
      "@type": "Offer",
      businessFunction: LEASE_OUT,
      priceCurrency: CURRENCY,
      availability: IN_STOCK,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.rent,
        priceCurrency: CURRENCY,
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
    });
  }
  return offers;
}

/**
 * The machine-readable copy of a listing page.
 *
 * It lives in its own file, and is tested, because of what it did wrong: the
 * visible table on a development withholds the container's beds, baths and
 * areas — those describe no dwelling anyone can buy — and prices it "from".
 * The structured data built directly beneath it, in the same function, did none
 * of that. It published floorSize 300 m², numberOfBedrooms 5 and a firm Offer
 * of 800,000 InStock to Google and every other consumer, where nobody reading
 * the page could see it.
 *
 * That is this project's recurring failure verbatim, and the second time on
 * this page (54d9490 was the first): a claim removed from the page and left in
 * the metadata. The rule now has one home. If a fact is withheld from the table
 * because a container does not own it, it is withheld here too — see
 * isContainer in lib/format.ts, which is the one definition of what a container
 * is; the price is `pricing` and the bedrooms `bedroomsOf`, the same functions
 * the table reads.
 *
 * SHAPE (2026-09-06). The page is a RealEstateListing; the thing it is about is
 * its `mainEntity`, typed from property_type, and the dwelling facts — address,
 * floor size, bedrooms, bathrooms, year built — live on that entity, because
 * they are facts about the dwelling and not about the web page. The offers
 * stay on the listing. A studio's `numberOfBedrooms` is 0, not absent.
 */
type Offer = Record<string, unknown>;

export interface ListingJsonLd {
  "@context": string;
  "@type": "RealEstateListing";
  name: string;
  description: string;
  url: string;
  image: (string | null)[];
  datePosted?: string;
  /** One offer is an object, two are an array — the shape consumers expect. Absent when unpriced. */
  offers?: Offer | Offer[];
  mainEntity: Record<string, unknown>;
}

export function listingJsonLd(l: Listing): ListingJsonLd {
  /* The same gate the visible facts table uses, from the same predicate. */
  const unitFacts = !isContainer(l);
  const summary = text(l.short_description);
  const body = text(l.public_description);
  const offers = offersFor(l);
  const bedrooms = bedroomsOf(l);

  const ld: ListingJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: titleOf(l),
    description: summary || body.slice(0, 300) || placeLine(l),
    // Absolute: a relative url in structured data is undefined behaviour for
    // every consumer that reads it away from this page.
    url: absolute(`/properties/${l.reference}`),
    image: (l.images ?? []).map((i) => i.card).filter(Boolean),
    mainEntity: {
      "@type": mainEntityType(l),
      name: titleOf(l),
      address: {
        "@type": "PostalAddress",
        addressLocality: text(l.area) || text(l.district),
        addressRegion: text(l.district),
        addressCountry: "CY",
      },
      ...(unitFacts && l.covered_area_sqm
        ? { floorSize: { "@type": "QuantitativeValue", value: l.covered_area_sqm, unitCode: "MTK" } }
        : {}),
      ...(bedrooms !== null ? { numberOfBedrooms: bedrooms } : {}),
      ...(unitFacts && l.bathrooms ? { numberOfBathroomsTotal: l.bathrooms } : {}),
      ...(yearBuiltLabel(l) ? { yearBuilt: l.year_built } : {}),
    },
  };
  if (l.published_at) ld.datePosted = l.published_at;
  if (offers.length === 1) ld.offers = offers[0]!;
  else if (offers.length > 1) ld.offers = offers;
  return ld;
}

/** Where this page sits, so a search result shows the path rather than a bare URL. */
export function listingBreadcrumbs(l: Listing) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
      { "@type": "ListItem", position: 2, name: "Properties", item: absolute("/properties") },
      {
        "@type": "ListItem",
        position: 3,
        name: titleOf(l),
        item: absolute(`/properties/${l.reference}`),
      },
    ],
  };
}
