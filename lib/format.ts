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
