/**
 * Where this site lives, in ONE place.
 *
 * It was declared separately in app/layout.tsx, app/robots.ts and
 * app/sitemap.ts. Three copies of a hostname is three chances to move two of
 * them: the day kalaitsidis.com replaces the vercel.app host, a copy left
 * behind does not fail loudly — it quietly publishes canonical URLs, a sitemap
 * or an og:url pointing at the old domain, which is the kind of error that is
 * only visible from outside the building.
 *
 * Absolute, no trailing slash. `absolute()` exists because structured data and
 * canonical links MUST carry a full URL: schema.org consumers and search
 * engines treat a relative one as undefined behaviour, and the listing page's
 * RealEstateListing was emitting "/properties/PAF0001".
 */
export const SITE_URL = (process.env.SITE_URL ?? "https://gnk-web.vercel.app").replace(/\/+$/, "");

export function absolute(path: string): string {
  return path.startsWith("http") ? path : SITE_URL + (path.startsWith("/") ? path : "/" + path);
}
