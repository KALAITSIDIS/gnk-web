import type { Listing, Multilang } from "@/lib/crm";

/** Phase 1 renders English. When /ru lands, this takes the active locale. */
export function text(m: Multilang | undefined, fallback = ""): string {
  if (!m) return fallback;
  return m.en?.trim() || m.el?.trim() || m.ru?.trim() || fallback;
}

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function money(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return EUR.format(Number(n));
}

/**
 * What a listing costs, said the way its transaction works. A rental priced
 * per month and a sale priced outright must never render identically.
 */
export function priceLabel(l: Listing): string {
  if (l.transaction_type === "rent") {
    const rent = money(l.rent_price_month);
    return rent ? `${rent} / month` : "Price on application";
  }
  return money(l.asking_price) ?? "Price on application";
}

export function area(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return `${new Intl.NumberFormat("en-IE").format(Number(n))} m²`;
}

/** €/m² — the number an advisory firm is expected to have already worked out. */
export function pricePerSqm(l: Listing): string | null {
  const price = l.transaction_type === "rent" ? null : l.asking_price;
  const size = l.covered_area_sqm;
  if (!price || !size || Number(size) <= 0) return null;
  return `${EUR.format(Math.round(Number(price) / Number(size)))} / m²`;
}

const WORDS: Record<string, string> = {
  sea_view: "Sea view",
  mountain_view: "Mountain view",
  communal_pool: "Communal pool",
  private_pool: "Private pool",
  veranda: "Veranda",
  roof_garden: "Roof garden",
  bbq_area: "BBQ area",
  storage: "Storage",
  parking: "Parking",
  garden: "Garden",
  furnished: "Furnished",
  air_conditioning: "Air conditioning",
  solar_water: "Solar water heating",
  fireplace: "Fireplace",
  gated: "Gated",
  lift: "Lift",
  gym: "Gym",
  title_deeds: "Title deeds",
};

/** Turn a stored token into something a buyer reads. Unknown tokens still render. */
export function label(token: string | null | undefined): string {
  if (!token) return "";
  return WORDS[token] ?? token.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** "Villa in Peyia, Paphos" — the line every competitor card uses, and the one buyers scan for. */
export function placeLine(l: Listing): string {
  const type = label(l.property_type);
  const where = [text(l.area), text(l.district)].filter(Boolean).join(", ");
  return where ? `${type} in ${where}` : type;
}

/** The cover photograph, or the first one, or nothing. */
export function coverImage(l: Listing) {
  const imgs = l.images ?? [];
  return imgs.find((i) => i.is_cover) ?? imgs[0] ?? null;
}

export function titleOf(l: Listing): string {
  return text(l.title) || placeLine(l);
}

/** Deed status matters more to a Cyprus buyer than almost anything else on the card. */
export function deedLabel(status: string | null): string | null {
  if (!status || status === "unknown") return null;
  const map: Record<string, string> = {
    separate: "Separate title deed",
    pending: "Title deed pending",
    shared: "Shared title deed",
    none: "No title deed",
  };
  return map[status] ?? label(status);
}

/**
 * VAT, said only where the property itself decides it.
 *
 * The CRM stores vat_status as a DECLARATION — someone picked it from a
 * dropdown, and gnk-crm's own lib/services/vat.ts records that nothing has ever
 * checked a reduced-rate claim survives contact with the caps. Crucially the
 * reduced rate turns on the BUYER (first home, residency, no prior claim), not
 * on the dwelling, so the CRM presents it as conditional and a public page
 * stating it flatly would be asserting something about a stranger.
 *
 * So: the two statuses that are facts about the property are published, and the
 * two that are not are withheld. `reduced_rate_eligible` is withheld because it
 * is a claim about the reader; `unknown` because it is an internal sentinel and
 * "VAT — Unknown" is worse than no row at all. The page already carries the
 * standing note that VAT varies with the buyer's circumstances, which is the
 * honest home for what is dropped here.
 *
 * Same shape and same reasoning as deedLabel above.
 */
export function vatLabel(status: string | null): string | null {
  const map: Record<string, string> = {
    resale_no_vat: "Resale — no VAT on the purchase",
    new_vat: "New build — VAT applies",
  };
  return status ? (map[status] ?? null) : null;
}

/** Build stages that mean the dwelling is not finished yet. */
const PRE_COMPLETION = new Set([
  "planning",
  "permit_applied",
  "permit_granted",
  "under_construction",
  "structure_complete",
  "finishing",
]);

/**
 * Whether this listing is genuinely still being built.
 *
 * Construction stage and a delivery date describe a building that does not yet
 * exist. Published against anything else they state a fact the firm cannot
 * back: PAF0001 is a completed 2007 villa whose stored status still read
 * "finishing", so the live page told buyers a nineteen-year-old house would be
 * delivered in November 2026, directly contradicting its own description.
 *
 * A recorded year built means the thing is standing, whatever the stage field
 * says — that is the check that catches stale data rather than trusting it.
 * Land is excluded outright: a plot has no construction, and "planning" on a
 * plot means planning permission, which is a different subject entirely.
 */
export function isUnderConstruction(l: Listing): boolean {
  if (l.property_type === "land") return false;
  if (l.year_built) return false;
  return PRE_COMPLETION.has(l.construction_status ?? "");
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * An expected handover, or nothing. Only for something still being built, and
 * only while the date is still ahead — a delivery date that has already passed
 * is stale data, and republishing it as a promise is worse than silence.
 */
export function deliveryLabel(l: Listing): string | null {
  if (!isUnderConstruction(l) || !l.delivery_date) return null;
  const d = new Date(l.delivery_date);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null;
  return DATE_FMT.format(d);
}

/** Build stage, only where it is true and only in the buyer's words. */
export function constructionLabel(l: Listing): string | null {
  return isUnderConstruction(l) ? label(l.construction_status) || null : null;
}
