import type { Listing } from "@/lib/crm";
import { isContainer, placeLine, text, titleOf } from "@/lib/format";
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
 * the metadata. The
 * rule now has one home. If a fact is withheld from the table because a
 * container does not own it, it is withheld here too — see isContainer in
 * lib/format.ts, which is the one definition of what a container is.
 */
export function listingJsonLd(l: Listing) {
  /* The same gate the visible facts table uses, from the same predicate. */
  const unitFacts = !isContainer(l);
  const currency = l.currency ?? "EUR";
  const summary = text(l.short_description);
  const body = text(l.public_description);

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: titleOf(l),
    description: summary || body.slice(0, 300) || placeLine(l),
    // Absolute: a relative url in structured data is undefined behaviour for
    // every consumer that reads it away from this page.
    url: absolute(`/properties/${l.reference}`),
    image: (l.images ?? []).map((i) => i.card).filter(Boolean),
    ...(l.asking_price
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
            ...(unitFacts
              ? { price: l.asking_price }
              : {
                  // A development's asking_price is the lowest of its units,
                  // not a price anything is for sale at. schema.org has a way
                  // to say exactly that, and `price` does not mean it — a firm
                  // 800,000 on a project whose villas start there is a figure
                  // no buyer can transact on.
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    minPrice: l.asking_price,
                    priceCurrency: currency,
                  },
                }),
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: text(l.area) || text(l.district),
      addressRegion: text(l.district),
      addressCountry: "CY",
    },
    ...(unitFacts && l.covered_area_sqm
      ? { floorSize: { "@type": "QuantitativeValue", value: l.covered_area_sqm, unitCode: "MTK" } }
      : {}),
    ...(unitFacts && l.bedrooms ? { numberOfBedrooms: l.bedrooms } : {}),
  };
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
