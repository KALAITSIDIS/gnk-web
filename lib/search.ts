import type { Listing } from "@/lib/crm";
import { bedroomsOf, isContainer, label, moneyShort, pricing } from "@/lib/format";

/**
 * The price ladder offered in the search bar.
 *
 * Every OTHER control on this bar is built from what actually exists — the type
 * list and the bedroom list are distinct values found in the listings — so
 * every option they offer can return something. The price steps were the one
 * exception: a fixed ladder filtered only against the highest price, which took
 * no account of the lowest.
 *
 * Measured on the live site with three published listings at €285,000,
 * €450,000 and €780,000, that offered "Up to €250k" — an option that cannot
 * match anything, because nothing is that cheap. On a book of three properties,
 * a filter whose only possible outcome is "Nothing here matches that yet" is
 * worse than no filter: it makes a short list look like a failed search.
 *
 * A step earns its place when it can INCLUDE something (>= the cheapest) and
 * still EXCLUDE something (< the dearest). Otherwise it is either empty or a
 * no-op that filters nothing out. This is the same rule the rest of the bar
 * already follows — a control renders only when it has more than one answer.
 */
export const PRICE_LADDER = [250_000, 500_000, 750_000, 1_000_000, 2_000_000, 5_000_000] as const;

export function priceStepsFor(prices: readonly number[]): number[] {
  if (prices.length < 2) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return PRICE_LADDER.filter((s) => s >= min && s < max);
}

/**
 * The bedroom counts the bar may offer, and the test a listing has to pass
 * when one is chosen.
 *
 * Both sat inline in the search component and read every listing's raw
 * `bedrooms` — a development's included, which is the one number every other
 * surface withholds (isContainer in lib/format.ts: PAF0002 carries 5 while its
 * villas carry 4). Offered as an option, that 5 was a step that could only
 * ever match the development itself, whose page then prints no bedroom count
 * at all; as a predicate it would have let a "4+" search return a project on
 * the strength of a figure the page refuses to show. Every other consumer was
 * gated the day the rule was written; this was the one still reading the raw
 * field, and the comment above even described it as correct.
 *
 * So a container contributes no option and matches no bedroom filter. It is
 * still found by type, price and text — placeLine says "development".
 */
export function bedroomOptionsFor(listings: readonly Listing[]): number[] {
  const seen = new Set<number>();
  for (const l of listings) {
    const n = bedroomsOf(l);
    // A studio's zero is a fact about the studio (bedroomsOf keeps it), but
    // "0+ bedrooms" is "any bedrooms": it is not an option.
    if (n !== null && n > 0) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Whether a listing satisfies a minimum-bedrooms filter; "" means no filter. */
export function matchesBedrooms(l: Listing, minBeds: string): boolean {
  if (!minBeds) return true;
  if (isContainer(l)) return false;
  return (bedroomsOf(l) ?? 0) >= Number(minBeds);
}

/**
 * The figure the price ladder is denominated in: what a listing is for sale
 * at, outright. A rental has no such figure — its 1,500 is a month, not a
 * price — so it contributes nothing to the ladder and satisfies no rung of it.
 *
 * The search bar used to read the price inline, twice, as
 * `transaction_type === "rent" ? rent_price_month : asking_price`: one array of
 * monthly rents and outright prices, one ceiling applied to both. On the live
 * book plus a single €1,500/month rental that would have offered "Up to €250k"
 * again — the step removed because no sale is that cheap — and returned the
 * rental alone beneath it, on a card reading "/ month". Same rule as the
 * bedroom control above: a listing contributes no option and matches no
 * filter for a figure it does not have. priceLabel in lib/format.ts is the
 * display side of the same rule, and the test pins that the two agree.
 */
export function salePrice(l: Listing): number | null {
  // Read from the one pricing, not from the columns: a listing for sale OR
  // rent is on the ladder by its sale figure, as its card says.
  return pricing(l).sale;
}

/** Whether a listing satisfies a maximum-price filter; "" means no filter. */
export function matchesMaxPrice(l: Listing, maxPrice: string): boolean {
  if (!maxPrice) return true;
  const p = pricing(l);
  if (!p.forSale) return false;
  // Price on application stays under any ceiling, as it always did: it may
  // well be under it, and the card says "Price on application" honestly.
  return !p.sale || p.sale <= Number(maxPrice);
}

/**
 * The search bar's state, as it lives in the URL: `?q&type&beds&max&sort`.
 *
 * It lived in React alone until 2026-09-13, so a filtered view could not be
 * linked, bookmarked, restored on reload, reached with the back button or
 * seen in the logs (audit WEB-04). The URL is caller text, so reading it back
 * is a validation, not a cast: a number that is not a number, a sort nobody
 * offers, a type that is not shaped like one, all fall back to the default
 * rather than into a predicate. Writing it out is the mirror: only what
 * differs from the default, in one order, so the clean URL stays clean and
 * two equal states always produce the same string.
 */
export const SORTS = ["newest", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];

export interface SearchState {
  q: string;
  type: string;
  beds: string;
  max: string;
  sort: Sort;
}

export const DEFAULT_SEARCH: SearchState = { q: "", type: "", beds: "", max: "", sort: "newest" };

/** Free text is capped where the input is: long enough for a place, short enough to be a search. */
const Q_MAX = 120;

export function parseSearchState(params: { get(name: string): string | null }): SearchState {
  const q = (params.get("q") ?? "").trim().slice(0, Q_MAX);
  const type = (params.get("type") ?? "").trim();
  const beds = (params.get("beds") ?? "").trim();
  const max = (params.get("max") ?? "").trim();
  const sort = (params.get("sort") ?? "").trim();
  return {
    q,
    // the CRM's enum shape: lowercase words and underscores
    type: /^[a-z_]{1,32}$/.test(type) ? type : "",
    beds: /^[1-9]$/.test(beds) ? beds : "",
    max: /^[1-9]\d{3,8}$/.test(max) ? max : "",
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : "newest",
  };
}

export function serializeSearchState(s: SearchState): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.type) p.set("type", s.type);
  if (s.beds) p.set("beds", s.beds);
  if (s.max) p.set("max", s.max);
  if (s.sort !== "newest") p.set("sort", s.sort);
  return p.toString();
}

/**
 * Newest is the feed's own order (published_at desc, then reference — the
 * CRM's public_listings sorts it). A price sort orders by the SALE figure,
 * the one the ladder is denominated in: a rental's month is not a price and
 * a listing on application has none, so both keep the feed's order at the
 * end rather than sorting as the cheapest thing on the page. Stable, and
 * never in place.
 */
export function sortListings(listings: readonly Listing[], sort: Sort): Listing[] {
  if (sort === "newest") return [...listings];
  const priced = listings.filter((l) => salePrice(l) !== null);
  const rest = listings.filter((l) => salePrice(l) === null);
  const dir = sort === "price-asc" ? 1 : -1;
  priced.sort((a, b) => dir * (salePrice(a)! - salePrice(b)!));
  return [...priced, ...rest];
}

/** The removable chips for what is filtering right now — never the sort, which removes nothing. */
export function activeFilters(s: SearchState): Array<{ key: keyof SearchState; label: string }> {
  const chips: Array<{ key: keyof SearchState; label: string }> = [];
  if (s.q) chips.push({ key: "q", label: `“${s.q}”` });
  if (s.type) chips.push({ key: "type", label: label(s.type) });
  if (s.beds) chips.push({ key: "beds", label: `${s.beds}+ bedrooms` });
  if (s.max) chips.push({ key: "max", label: `Up to ${moneyShort(Number(s.max))}` });
  return chips;
}
