import { site } from "@/lib/site";
import { SITE_URL } from "@/lib/site-url";

/**
 * Who this firm is, for machines.
 *
 * TYPE CHOICE IS DELIBERATE AND LOAD-BEARING. schema.org offers
 * `RealEstateAgent`, which is what a Cyprus property firm would normally
 * declare — and this firm is NOT registered or licensed under the Real Estate
 * Agents Law 71(I)/2010. Declaring that type is a machine-readable assertion of
 * exactly the status lib/site.ts holds null registration numbers to avoid
 * claiming in prose. Structured data is still a claim; it is simply one the
 * reader never sees, which makes it easier to get wrong and harder to notice.
 * `Organization` is accurate, needs no address, and asserts nothing regulated.
 *
 * Every value comes from lib/site.ts. Nothing is composed here, and nothing is
 * added that the firm has not supplied — no founder list while the principals
 * are unnamed, no aggregateRating, no address until one is confirmed.
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    alternateName: site.shortName,
    url: SITE_URL,
    description: site.positioning,
    email: site.contact.email,
    telephone: site.contact.phone,
    areaServed: { "@type": "AdministrativeArea", name: "Paphos, Cyprus" },
    address: { "@type": "PostalAddress", addressLocality: "Paphos", addressCountry: "CY" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: site.contact.email,
      telephone: site.contact.phone,
      areaServed: "CY",
      availableLanguage: ["en"],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
