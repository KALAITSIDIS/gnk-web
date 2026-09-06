import type { Listing } from "@/lib/crm";
import { isContainer } from "@/lib/format";

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
    if (isContainer(l)) continue;
    if (l.bedrooms) seen.add(l.bedrooms);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Whether a listing satisfies a minimum-bedrooms filter; "" means no filter. */
export function matchesBedrooms(l: Listing, minBeds: string): boolean {
  if (!minBeds) return true;
  if (isContainer(l)) return false;
  return (l.bedrooms ?? 0) >= Number(minBeds);
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
  if (l.transaction_type === "rent") return null;
  return l.asking_price ?? null;
}

/** Whether a listing satisfies a maximum-price filter; "" means no filter. */
export function matchesMaxPrice(l: Listing, maxPrice: string): boolean {
  if (!maxPrice) return true;
  if (l.transaction_type === "rent") return false;
  const p = salePrice(l);
  // Price on application stays under any ceiling, as it always did: it may
  // well be under it, and the card says "Price on application" honestly.
  return !p || p <= Number(maxPrice);
}
