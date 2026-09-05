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
/**
 * A development is not a dwelling, and almost nothing on a container describes
 * something a buyer can buy.
 *
 * The CRM is explicit about this — "a container's price is its units' prices;
 * the container's own asking_price is a 'from' figure" — and its create wizard
 * labels that field "From price". The units carry the beds, the baths and the
 * area; the container's own copies of those fields are whatever was typed when
 * the record was made, and they are frequently NOT the units' figures.
 *
 * Measured on PAF0002 before it was published: the container reads 5 bedrooms,
 * 5 bathrooms and 300 m² while its six villas are 4, 4 and 250 — so the page
 * would have stated four wrong facts, plus a €/m² of 800000/300 computed from
 * two numbers that do not describe the same object. The publish gate scores
 * that record 100/100, because the gate measures whether fields are filled and
 * not whether they are true.
 *
 * So: a container prices "from", and its unit-shaped rows are withheld. What is
 * genuinely true of a development — that it is one, its build stage and its
 * delivery date — still renders.
 */
export function isContainer(l: Listing): boolean {
  return l.kind === "project" || l.kind === "phase";
}

export function priceLabel(l: Listing): string {
  if (l.transaction_type === "rent") {
    const rent = money(l.rent_price_month);
    return rent ? `${rent} / month` : "Price on application";
  }
  const price = money(l.asking_price);
  if (!price) return "Price on application";
  // "from", because the units carry the real prices and this is the lowest.
  return isContainer(l) ? `from ${price}` : price;
}

export function area(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return `${new Intl.NumberFormat("en-IE").format(Number(n))} m²`;
}

/** €/m² — the number an advisory firm is expected to have already worked out. */
export function pricePerSqm(l: Listing): string | null {
  // A container's "from" price over a container's own covered area is a ratio
  // between two unrelated numbers. See isContainer above.
  if (isContainer(l)) return null;
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

/**
 * Property types that ARE a floor inside somebody else's building.
 * Everything else owns its storeys rather than occupying one of them.
 */
const UNITS_IN_A_BUILDING = new Set(["apartment", "office", "shop"]);

function isUnitInABuilding(l: Listing): boolean {
  return l.kind === "unit" || UNITS_IN_A_BUILDING.has(l.property_type);
}

/**
 * "2 of 2" is a POSITION, and only a unit has one.
 *
 * The site composed floor_number and total_floors into that string for every
 * listing, so PAF0001 — a detached villa on a 1,200 m² plot — published "Floor
 * 2 of 2" directly beneath an H1 reading "Two-storey villa" and body text
 * saying "three bedrooms across two floors". A buyer reads that as a
 * second-floor apartment. The CRM never composes these two fields; the
 * relationship was the site's own invention, asserted on a live client mandate.
 *
 * For a whole dwelling the same number means something different and useful —
 * how many storeys it has — so it is said separately rather than suppressed.
 */
export function floorLabel(l: Listing): string | null {
  if (isContainer(l) || !isUnitInABuilding(l)) return null;
  return l.floor_number !== null && l.total_floors
    ? `${l.floor_number} of ${l.total_floors}`
    : null;
}

/** How many storeys a whole dwelling has. Meaningless for land, and for a unit. */
export function storeysLabel(l: Listing): string | null {
  if (isContainer(l) || l.property_type === "land" || isUnitInABuilding(l)) return null;
  return l.total_floors && l.total_floors > 1 ? String(l.total_floors) : null;
}
