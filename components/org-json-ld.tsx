import { organizationJsonLd } from "@/lib/jsonld";

/**
 * Who this firm is, for machines. The object itself lives in lib/jsonld.ts,
 * where it is tested and where the type choice (Organization, never the
 * regulated RealEstateAgent) and the address rule are written down once.
 */
export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
    />
  );
}
