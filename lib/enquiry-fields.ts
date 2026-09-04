/**
 * The vocabulary a seller's enquiry is written in, taken verbatim from the CRM.
 *
 * WHY IT IS COPIED RATHER THAN INVENTED. An enquiry that arrives in the desk's
 * own words is one nobody has to re-key: `property_type`, `title_deed_status`,
 * `covered_area_sqm` and the area names are the CRM's, so turning a lead into a
 * property is transcription rather than translation. Free text here would mean
 * somebody typing "Pegia" and somebody else typing "Peyia".
 *
 * These lists WILL drift from the CRM eventually — the site holds no
 * credentials and cannot read the enum. That is a deliberate trade: a stale
 * option renders a slightly wrong label on a form, whereas a live connection
 * would mean giving a public marketing site a database reach it has no business
 * having. If a type or an area is added in the CRM, add it here too.
 * Verified against the CRM 2026-09-04.
 */

export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "townhouse",
  "house",
  "land",
  "shop",
  "office",
  "building",
  "warehouse",
  "mixed_use",
  "other",
] as const;

export const DEED_STATUSES = [
  { value: "separate", label: "Separate title deed issued" },
  { value: "shared", label: "Shared title deed" },
  { value: "pending", label: "Deed applied for, not yet issued" },
  { value: "none", label: "No title deed" },
  { value: "unknown", label: "I am not sure" },
] as const;

/** District first, because it decides which areas are worth showing. */
export const AREAS: Record<string, string[]> = {
  Paphos: [
    "Chloraka",
    "Geroskipou",
    "Kato Paphos",
    "Peyia / Coral Bay",
    "Polis",
    "Tala / Tsada",
    "Universal",
  ],
  Limassol: ["Agios Athanasios", "Agios Tychonas", "City Centre / Molos", "Germasogeia"],
};

export const TIMINGS = [
  { value: "now", label: "Ready to sell now" },
  { value: "3_months", label: "Within about three months" },
  { value: "this_year", label: "Sometime this year" },
  { value: "exploring", label: "Just want to know what it is worth" },
] as const;

export const LISTED_ELSEWHERE = [
  { value: "no", label: "No, not listed anywhere" },
  { value: "yes_agent", label: "Yes, with another agent" },
  { value: "yes_private", label: "Yes, privately" },
] as const;

export const SELLER_KEYS = [
  "district",
  "area",
  "property_type",
  "bedrooms",
  "covered_area_sqm",
  "plot_area_sqm",
  "year_built",
  "title_deed_status",
  "listed_elsewhere",
  "timing",
] as const;

export interface SellerFields {
  district?: string;
  area?: string;
  property_type?: string;
  bedrooms?: string;
  covered_area_sqm?: string;
  plot_area_sqm?: string;
  year_built?: string;
  title_deed_status?: string;
  listed_elsewhere?: string;
  timing?: string;
}

const LABELS: Record<keyof SellerFields, string> = {
  district: "District",
  area: "Area",
  property_type: "Property type",
  bedrooms: "Bedrooms",
  covered_area_sqm: "Covered area (m²)",
  plot_area_sqm: "Plot (m²)",
  year_built: "Year built",
  title_deed_status: "Title deed",
  listed_elsewhere: "Currently listed",
  timing: "Timing",
};

function pretty(key: keyof SellerFields, value: string): string {
  if (key === "title_deed_status") {
    return DEED_STATUSES.find((d) => d.value === value)?.label ?? value;
  }
  if (key === "timing") return TIMINGS.find((t) => t.value === value)?.label ?? value;
  if (key === "listed_elsewhere") {
    return LISTED_ELSEWHERE.find((l) => l.value === value)?.label ?? value;
  }
  if (key === "property_type") return value.replace(/_/g, " ");
  return value;
}

/**
 * The block a seller's answers become in the lead's message.
 *
 * ONE implementation, used by both submit paths. The browser posts JSON once
 * React has hydrated and plain form-encoded when it has not, and both land
 * here — so a seller with JavaScript disabled reaches the desk in exactly the
 * same shape as everyone else, rather than as a lead missing half its answers.
 * Empty fields are omitted entirely: a row reading "Plot: —" is noise the desk
 * has to read past.
 */
export function describeProperty(f: SellerFields): string | null {
  const lines = (Object.keys(LABELS) as (keyof SellerFields)[])
    .map((k) => {
      const v = f[k]?.trim();
      return v ? `${LABELS[k]}: ${pretty(k, v)}` : null;
    })
    .filter((l): l is string => l !== null);
  return lines.length ? `About the property\n${lines.join("\n")}` : null;
}
