import type { Listing } from "@/lib/crm";
import { text } from "@/lib/format";

/**
 * The onward path from a listing: the closest other listings on the book.
 *
 * A buyer who reaches a listing page from a search result or a shared link
 * and decides against it had, until 2026-09-13, nowhere to go but the
 * browser's back button (audit FP4). These are the other listings ranked by
 * how close they are — same area first, then the same district, then the
 * rest — with the feed's own order kept inside each tier, so the newest of
 * equals comes first. The listing itself is never in its own list, whatever
 * case its reference arrived in.
 *
 * The page renders the block only when this returns something: a heading
 * over nothing would advertise the size of the book, which no surface on
 * the site does.
 */
export function relatedListings(current: Listing, all: readonly Listing[], limit = 3): Listing[] {
  const self = current.reference.toLowerCase();
  const area = text(current.area);
  const district = text(current.district);
  const tier = (l: Listing): number => {
    if (area && text(l.area) === area) return 0;
    if (district && text(l.district) === district) return 1;
    return 2;
  };
  return all
    .filter((l) => l.reference.toLowerCase() !== self)
    .map((l, i) => ({ l, i, t: tier(l) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.l);
}

/**
 * The block's heading names the narrowest place EVERY card in it shares
 * with the listing: the area when all of them are in it, else the district,
 * else nothing. "Other properties in Peyia / Coral Bay" above a card in Kato
 * Paphos would be the site's recurring failure — a claim the content under
 * it does not back — so the heading is derived from the cards, never
 * assumed from the listing.
 */
export function relatedHeading(current: Listing, picked: readonly Listing[]): string {
  const area = text(current.area);
  const district = text(current.district);
  if (picked.length > 0 && area && picked.every((l) => text(l.area) === area)) {
    return `Other properties in ${area}`;
  }
  if (picked.length > 0 && district && picked.every((l) => text(l.district) === district)) {
    return `Other properties in ${district}`;
  }
  return "Other properties";
}
