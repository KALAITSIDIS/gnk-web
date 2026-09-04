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

/**
 * The CRM's hard limit on a lead's message.
 *
 * Mirrored from gnk-crm: 0084_public_enquiries.sql returns false above this and
 * lib/validators/public-enquiry.ts refuses with a 400 carrying zod's own words.
 * Nothing anywhere truncates — the enquiry is simply lost.
 */
export const CRM_MESSAGE_CAP = 5000;

const CONSENT_LINE = "— Consent given to be contacted about this enquiry.";
const TRIMMED_MARK = "\n\n[The rest of this message did not fit — ask them for it.]";

/**
 * Everything the desk receives, guaranteed to fit.
 *
 * WHY THIS EXISTS. The visitor's message was validated against 5000 and THEN
 * had the property block and the consent line appended, so a real form
 * submission could reach 5409 and be refused outright by the CRM — on the one
 * page built to invite owners to write at length about their property. The
 * seller saw a raw validator string, or with JavaScript off a "that did not
 * send" page with everything they had typed gone.
 *
 * The visitor's own words are the half that gets trimmed, never the structured
 * block: the block is short, fixed, and the reason the lead is useful, while a
 * long description is the part the desk can simply ask them to repeat. A trim
 * is marked, so nobody reads a severed sentence as the whole thought.
 */
export function assembleMessage(visitorMessage: string | undefined, fields: SellerFields): string {
  const suffix = [describeProperty(fields), CONSENT_LINE].filter(Boolean).join("\n\n");
  const own = (visitorMessage ?? "").trim();
  if (!own) return suffix;

  const budget = CRM_MESSAGE_CAP - suffix.length - 2; // the join between the two halves
  if (own.length <= budget) return own + "\n\n" + suffix;

  const room = Math.max(0, budget - TRIMMED_MARK.length);
  return own.slice(0, room) + TRIMMED_MARK + "\n\n" + suffix;
}

/**
 * What the textarea may honestly advertise, given what gets appended to it.
 * The server guarantees the cap either way; this stops the form promising a
 * budget the route cannot honour.
 */
export function messageBudget(seller: boolean): number {
  if (!seller) return CRM_MESSAGE_CAP - CONSENT_LINE.length - 2;
  const worst = describeProperty({
    district: "x".repeat(60),
    area: "x".repeat(80),
    property_type: "x".repeat(40),
    bedrooms: "x".repeat(20),
    covered_area_sqm: "x".repeat(20),
    plot_area_sqm: "x".repeat(20),
    year_built: "x".repeat(20),
    title_deed_status: "x".repeat(40),
    listed_elsewhere: "x".repeat(40),
    timing: "x".repeat(40),
  });
  return CRM_MESSAGE_CAP - (worst ?? "").length - 2 - CONSENT_LINE.length - 2;
}
