import { site } from "@/lib/site";

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

/**
 * The OpenGraph fields every page shares.
 *
 * THEY HAVE TO BE REPEATED PER PAGE, and that is not a style choice. Next
 * merges metadata SHALLOWLY: an `openGraph` object in a page REPLACES the one
 * in the layout rather than merging into it. Setting `openGraph: { url }` per
 * page — which is what naming each page correctly requires — therefore silently
 * deleted the layout's type, locale, siteName and image from every page that
 * did it. Nothing failed; the tags simply stopped being emitted, which is only
 * visible by reading the served HTML.
 *
 * So the shared half lives here and every page spreads it. A page that needs a
 * different image (a listing, which has a photograph) overrides just that key.
 */
export const OG_BASE = {
  type: "website" as const,
  locale: "en",
  siteName: site.name,
  images: [{ url: "/api/og", width: 1200, height: 630, alt: site.name }],
};

/**
 * The two URL facts every page has to state about itself, plus the shared
 * OpenGraph block it would otherwise destroy.
 *
 * `og:url` is not decoration: Facebook and LinkedIn treat it as the IDENTITY of
 * the shared object, so a wrong one attributes a shared /selling link to the
 * home page. The root layout used to set it once, which meant every page
 * claimed to be the home page. A canonical is the same fact told to search
 * engines, and there was none at all.
 *
 * Both paths are relative on purpose: Next resolves them against metadataBase,
 * which reads SITE_URL above, so the domain cutover changes one line and every
 * canonical, og:url and card on the site follows.
 */
export function pageMeta(path: string) {
  return {
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, url: path },
  };
}
