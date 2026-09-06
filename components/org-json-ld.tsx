import { JsonLd } from "@/components/json-ld";
import { organizationJsonLd } from "@/lib/jsonld";

/**
 * Who this firm is, for machines. The object lives in lib/jsonld.ts, where it
 * is tested and where the type choice (Organization, never the regulated
 * RealEstateAgent) and the address rule are written down once; the sink lives
 * in components/json-ld.tsx, where escaping is done once.
 */
export function OrganizationJsonLd() {
  return <JsonLd data={organizationJsonLd()} />;
}
