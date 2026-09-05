/**
 * The price ladder offered in the search bar.
 *
 * Every OTHER control on this bar is built from what actually exists — the type
 * list and the bedroom list are the distinct values found in the listings — so
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
